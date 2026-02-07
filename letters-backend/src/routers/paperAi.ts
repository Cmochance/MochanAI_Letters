import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  expandPaperContent,
  generatePaperOutline,
  getOutlineFromStoredPlan,
  outlineToText,
} from "../services/ai.js";

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

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

async function processPaperExpandJob(jobId: number, userId: number) {
  const settings = await db.getUserSettings(userId);
  const job = await db.getExpandJobById(userId, jobId);

  if (!job) return;

  await db.updateExpandJob(jobId, userId, {
    status: "running",
    startedAt: new Date(),
  });

  try {
    const content = await expandPaperContent(
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
    console.error("Paper expand job failed", { jobId, userId, error });

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

export const paperAiRouter = router({
  generateOutline: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        sectionNumber: z.number().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const settings = await db.getUserSettings(ctx.user.id);
      const outline = await generatePaperOutline(
        input.paperId,
        input.sectionNumber,
        settings?.apiKey || undefined,
        settings?.apiBaseUrl || undefined,
        settings?.modelName || undefined,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      );

      const saved = await db.createPlanVersion(
        ctx.user.id,
        "paper",
        input.paperId,
        input.sectionNumber,
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
        paperId: z.number(),
        outline: z.string().optional(),
        targetWords: z.number().optional(),
        planDocumentId: z.number().optional(),
        version: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const settings = await db.getUserSettings(ctx.user.id);
      const { outlineText } = await resolveOutlineFromInput(ctx.user.id, input);

      const content = await expandPaperContent(
        input.paperId,
        outlineText,
        settings?.writingStyle || null,
        input.targetWords || 2500,
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
        paperId: z.number(),
        outline: z.string().optional(),
        targetWords: z.number().min(500).max(15000).optional(),
        planDocumentId: z.number().optional(),
        version: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const { outlineText, planDocumentId } = await resolveOutlineFromInput(
        ctx.user.id,
        input
      );

      let job;
      try {
        job = await db.createExpandJob({
          userId: ctx.user.id,
          workspaceType: "paper",
          workspaceId: input.paperId,
          outline: outlineText,
          targetWords: input.targetWords || 2500,
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
        processPaperExpandJob(job.id, ctx.user.id).catch((error) => {
          console.error("Failed to process paper expand job", {
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
      if (!job || job.workspaceType !== "paper") {
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
        paperId: z.number(),
        limit: z.number().min(1).max(50).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const jobs = await db.getExpandJobsByWorkspace(
        ctx.user.id,
        "paper",
        input.paperId,
        input.limit || 10
      );

      return jobs.map((job) => ({
        id: job.id,
        status: job.status,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        errorMessage: job.errorMessage,
      }));
    }),
});
