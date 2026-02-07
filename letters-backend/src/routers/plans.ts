import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";

const workspaceTypeSchema = z.enum(["novel", "paper"]);

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

export const plansRouter = router({
  getLatest: protectedProcedure
    .input(
      z.object({
        workspaceType: workspaceTypeSchema,
        workspaceId: z.number(),
        sectionNumber: z.number().min(1),
        chapterId: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let result;
      try {
        result = await db.getLatestPlanByScope(
          ctx.user.id,
          input.workspaceType,
          input.workspaceId,
          input.sectionNumber,
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

      if (!result) {
        return null;
      }

      return {
        planDocumentId: result.document.id,
        workspaceType: result.document.workspaceType,
        workspaceId: result.document.workspaceId,
        chapterId: result.document.chapterId,
        sectionNumber: result.document.sectionNumber,
        version: result.version.version,
        theme: result.version.theme,
        framework: result.version.framework,
        conflicts: result.version.conflicts,
        interactions: result.version.interactions,
        createdAt: result.version.createdAt,
      };
    }),

  listVersions: protectedProcedure
    .input(
      z.object({
        planDocumentId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      const document = await db.getPlanDocumentById(ctx.user.id, input.planDocumentId);
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "规划文档不存在" });
      }

      const versions = await db.listPlanVersions(input.planDocumentId);
      return versions.map((version) => ({
        version: version.version,
        theme: version.theme,
        framework: version.framework,
        conflicts: version.conflicts,
        interactions: version.interactions,
        createdAt: version.createdAt,
      }));
    }),

  getVersion: protectedProcedure
    .input(
      z.object({
        planDocumentId: z.number(),
        version: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const document = await db.getPlanDocumentById(ctx.user.id, input.planDocumentId);
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "规划文档不存在" });
      }

      const resolvedVersion =
        input.version !== undefined
          ? await db.getPlanVersion(input.planDocumentId, input.version)
          : await db.getLatestPlanVersion(input.planDocumentId);

      if (!resolvedVersion) {
        throw new TRPCError({ code: "NOT_FOUND", message: "规划版本不存在" });
      }

      return {
        planDocumentId: input.planDocumentId,
        workspaceType: document.workspaceType,
        workspaceId: document.workspaceId,
        chapterId: document.chapterId,
        sectionNumber: document.sectionNumber,
        version: resolvedVersion.version,
        theme: resolvedVersion.theme,
        framework: resolvedVersion.framework,
        conflicts: resolvedVersion.conflicts,
        interactions: resolvedVersion.interactions,
        createdAt: resolvedVersion.createdAt,
      };
    }),

  saveVersion: protectedProcedure
    .input(
      z.object({
        planDocumentId: z.number(),
        theme: z.string(),
        framework: z.string(),
        conflicts: z.string(),
        interactions: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await db.getPlanDocumentById(ctx.user.id, input.planDocumentId);
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "规划文档不存在" });
      }

      const version = await db.createPlanVersionForDocument(input.planDocumentId, {
        theme: input.theme,
        framework: input.framework,
        conflicts: input.conflicts,
        interactions: input.interactions,
      });

      return {
        planDocumentId: input.planDocumentId,
        version: version.version,
        theme: version.theme,
        framework: version.framework,
        conflicts: version.conflicts,
        interactions: version.interactions,
        createdAt: version.createdAt,
      };
    }),
});
