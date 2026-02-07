import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  generateChapterOutline,
  expandChapterContent,
  generateChapterPoeticTitle,
  getOutlineFromStoredPlan,
  outlineToText,
} from "../services/ai.js";
import {
  vectorizeChapter,
  vectorizeNovel,
  getNovelEmbeddingStats,
  searchRAGContext,
} from "../services/rag.js";

function getJobErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown expansion error";
}

function isMissingAsyncJobSchemaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    (msg.includes("ai_expand_jobs") &&
      (msg.includes("does not exist") ||
        msg.includes("relation") ||
        msg.includes("不存在"))) ||
    (msg.includes("chapter_id") &&
      (msg.includes("does not exist") ||
        msg.includes("column") ||
        msg.includes("不存在"))) ||
    (msg.includes("ai_plan_documents") &&
      msg.includes("chapter_id") &&
      (msg.includes("does not exist") ||
        msg.includes("column") ||
        msg.includes("不存在")))
  );
}

function isMissingPlanChapterScopeError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  return (
    msg.includes("ai_plan_documents") &&
    msg.includes("chapter_id") &&
    (msg.includes("does not exist") ||
      msg.includes("column") ||
      msg.includes("不存在"))
  );
}

async function processNovelExpandJob(jobId: number, userId: number) {
  const settings = await db.getUserSettings(userId);
  const job = await db.getExpandJobById(userId, jobId);

  if (!job) return;

  await db.updateExpandJob(jobId, userId, {
    status: "running",
    startedAt: new Date(),
  });

  try {
    const content = await expandChapterContent(
      job.workspaceId,
      job.outline,
      settings?.writingStyle || null,
      job.targetWords,
      settings?.apiKey || undefined,
      settings?.apiBaseUrl || undefined,
      settings?.modelName || undefined,
      settings?.embeddingApiKey || undefined,
      settings?.embeddingBaseUrl || undefined,
      settings?.embeddingModel || undefined
    );

    await db.updateExpandJob(jobId, userId, {
      status: "succeeded",
      resultContent: content,
      errorMessage: null,
      finishedAt: new Date(),
    });
  } catch (error) {
    console.error("Novel expand job failed", { jobId, userId, error });
    await db.updateExpandJob(jobId, userId, {
      status: "failed",
      errorMessage: getJobErrorMessage(error),
      finishedAt: new Date(),
    });
  }
}

async function resolveOutlineFromInput(
  userId: number,
  input: {
    outline?: string;
    planDocumentId?: number;
    version?: number;
  }
): Promise<{ outlineText: string; planDocumentId: number | null }> {
  if (input.outline && input.outline.trim().length > 0) {
    return {
      outlineText: input.outline,
      planDocumentId: input.planDocumentId ?? null,
    };
  }

  if (!input.planDocumentId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "outline 或 planDocumentId 至少提供一个",
    });
  }

  const plan = await getOutlineFromStoredPlan(
    userId,
    input.planDocumentId,
    input.version
  );

  if (!plan) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "未找到对应规划版本",
    });
  }

  return {
    outlineText: outlineToText(plan),
    planDocumentId: input.planDocumentId,
  };
}

async function ensureNovelChapterOwner(novelId: number, chapterId?: number) {
  if (!chapterId) return;

  const chapter = await db.getChapterById(chapterId);
  if (!chapter || chapter.novelId !== novelId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Chapter not found",
    });
  }
}

async function resolveChapterNumber(
  novelId: number,
  chapterNumber: number,
  chapterId?: number
) {
  if (!chapterId) {
    return chapterNumber;
  }

  const chapter = await db.getChapterById(chapterId);
  if (!chapter || chapter.novelId !== novelId) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Chapter not found",
    });
  }
  return chapter.chapterNumber;
}

export const aiRouter = router({
  generateOutline: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterNumber: z.number().min(1),
        chapterId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found" });
      }
      await ensureNovelChapterOwner(input.novelId, input.chapterId);

      const resolvedChapterNumber = await resolveChapterNumber(
        input.novelId,
        input.chapterNumber,
        input.chapterId
      );

      const settings = await db.getUserSettings(ctx.user.id);

      const outline = await generateChapterOutline(
        input.novelId,
        resolvedChapterNumber,
        settings?.apiKey || undefined,
        settings?.apiBaseUrl || undefined,
        settings?.modelName || undefined,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      let saved;
      try {
        saved = await db.createPlanVersion(
          ctx.user.id,
          "novel",
          input.novelId,
          resolvedChapterNumber,
          outline,
          input.chapterId
        );
      } catch (error) {
        if (isMissingPlanChapterScopeError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "规划表结构不完整，请执行数据库迁移（0004_ai_plan_documents_chapter_scope.sql）",
          });
        }
        throw error;
      }

      return {
        ...outline,
        planDocumentId: saved.document.id,
        version: saved.version.version,
        chapterNumber: resolvedChapterNumber,
        chapterId: input.chapterId ?? saved.document.chapterId ?? null,
      };
    }),

  expandContent: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterId: z.number().optional(),
        outline: z.string().optional(),
        targetWords: z.number().optional(),
        planDocumentId: z.number().optional(),
        version: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found" });
      }
      await ensureNovelChapterOwner(input.novelId, input.chapterId);

      const settings = await db.getUserSettings(ctx.user.id);
      const { outlineText } = await resolveOutlineFromInput(ctx.user.id, input);

      const content = await expandChapterContent(
        input.novelId,
        outlineText,
        settings?.writingStyle || null,
        input.targetWords || 4000,
        settings?.apiKey || undefined,
        settings?.apiBaseUrl || undefined,
        settings?.modelName || undefined,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      return { content };
    }),

  generateChapterTitle: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterId: z.number(),
        content: z.string().min(20),
        outline: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found" });
      }
      await ensureNovelChapterOwner(input.novelId, input.chapterId);

      const chapter = await db.getChapterById(input.chapterId);
      if (!chapter) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found" });
      }

      const settings = await db.getUserSettings(ctx.user.id);
      const title = await generateChapterPoeticTitle(
        chapter.chapterNumber,
        input.content,
        input.outline,
        settings?.apiKey || undefined,
        settings?.apiBaseUrl || undefined,
        settings?.modelName || undefined
      );

      return { title };
    }),

  expandContentAsync: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterId: z.number().optional(),
        outline: z.string().optional(),
        targetWords: z.number().min(500).max(20000).optional(),
        planDocumentId: z.number().optional(),
        version: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found" });
      }
      await ensureNovelChapterOwner(input.novelId, input.chapterId);

      const { outlineText, planDocumentId } = await resolveOutlineFromInput(
        ctx.user.id,
        input
      );

      let job;
      try {
        job = await db.createExpandJob({
          userId: ctx.user.id,
          workspaceType: "novel",
          workspaceId: input.novelId,
          chapterId: input.chapterId,
          outline: outlineText,
          targetWords: input.targetWords || 4000,
          planDocumentId,
          status: "pending",
        });
      } catch (error) {
        if (isMissingAsyncJobSchemaError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "异步扩写任务表结构不完整，请执行数据库迁移（0002_workspace_plans_papers.sql 和 0003_ai_expand_jobs_chapter_scope.sql）",
          });
        }
        throw error;
      }

      setTimeout(() => {
        processNovelExpandJob(job.id, ctx.user.id).catch((error) => {
          console.error("Failed to process novel expand job", {
            jobId: job.id,
            userId: ctx.user.id,
            error,
          });
        });
      }, 0);

      return {
        jobId: job.id,
        status: job.status,
      };
    }),

  getExpandJob: protectedProcedure
    .input(
      z.object({
        jobId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const job = await db.getExpandJobById(ctx.user.id, input.jobId);
      if (!job || job.workspaceType !== "novel") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "扩写任务不存在",
        });
      }

      return {
        id: job.id,
        status: job.status,
        resultContent: job.resultContent,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      };
    }),

  listExpandJobs: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterId: z.number().optional(),
        limit: z.number().min(1).max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found" });
      }
      await ensureNovelChapterOwner(input.novelId, input.chapterId);

      let jobs;
      try {
        jobs = await db.getExpandJobsByWorkspace(
          ctx.user.id,
          "novel",
          input.novelId,
          input.limit || 10,
          input.chapterId
        );
      } catch (error) {
        if (isMissingAsyncJobSchemaError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "异步扩写任务表结构不完整，请执行数据库迁移（0002_workspace_plans_papers.sql 和 0003_ai_expand_jobs_chapter_scope.sql）",
          });
        }
        throw error;
      }

      return jobs.map((job) => ({
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
      }));
    }),

  vectorizeChapter: protectedProcedure
    .input(
      z.object({
        chapterId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getUserSettings(ctx.user.id);

      const result = await vectorizeChapter(
        input.chapterId,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      return result;
    }),

  vectorizeNovel: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getUserSettings(ctx.user.id);

      const result = await vectorizeNovel(
        input.novelId,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      return result;
    }),

  getEmbeddingStats: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return getNovelEmbeddingStats(input.novelId);
    }),

  searchContext: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        query: z.string(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const settings = await db.getUserSettings(ctx.user.id);

      const results = await searchRAGContext(
        input.novelId,
        input.query,
        input.limit || 5,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      return results;
    }),
});
