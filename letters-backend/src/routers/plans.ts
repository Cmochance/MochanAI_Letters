import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";

const workspaceTypeSchema = z.enum(["novel", "paper"]);

export const plansRouter = router({
  getLatest: protectedProcedure
    .input(
      z.object({
        workspaceType: workspaceTypeSchema,
        workspaceId: z.number(),
        sectionNumber: z.number().min(1),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await db.getLatestPlanByScope(
        ctx.user.id,
        input.workspaceType,
        input.workspaceId,
        input.sectionNumber
      );

      if (!result) {
        return null;
      }

      return {
        planDocumentId: result.document.id,
        workspaceType: result.document.workspaceType,
        workspaceId: result.document.workspaceId,
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
        sectionNumber: document.sectionNumber,
        version: resolvedVersion.version,
        theme: resolvedVersion.theme,
        framework: resolvedVersion.framework,
        conflicts: resolvedVersion.conflicts,
        interactions: resolvedVersion.interactions,
        createdAt: resolvedVersion.createdAt,
      };
    }),
});
