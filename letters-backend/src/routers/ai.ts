import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  generateChapterOutline,
  expandChapterContent,
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

function isMissingAsyncJobTableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("ai_expand_jobs") &&
    (error.message.includes("does not exist") ||
      error.message.includes("relation") ||
      error.message.includes("不存在"))
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

export const aiRouter = router({
  generateOutline: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterNumber: z.number().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found" });
      }

      const settings = await db.getUserSettings(ctx.user.id);

      const outline = await generateChapterOutline(
        input.novelId,
        input.chapterNumber,
        settings?.apiKey || undefined,
        settings?.apiBaseUrl || undefined,
        settings?.modelName || undefined,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      const saved = await db.createPlanVersion(
        ctx.user.id,
        "novel",
        input.novelId,
        input.chapterNumber,
        outline
      );

      return {
        ...outline,
        planDocumentId: saved.document.id,
        version: saved.version.version,
      };
    }),

  expandContent: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
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

  expandContentAsync: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
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
          outline: outlineText,
          targetWords: input.targetWords || 4000,
          planDocumentId,
          status: "pending",
        });
      } catch (error) {
        if (isMissingAsyncJobTableError(error)) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "异步扩写任务表不存在，请先执行数据库迁移（0002_workspace_plans_papers.sql）",
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
