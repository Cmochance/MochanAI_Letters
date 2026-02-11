import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  enqueuePaperForBackfill,
  getPaperKnowledgeStatus,
  syncPaperKnowledge,
} from "../services/paperKnowledge.js";

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperKnowledgeRouter = router({
  getStatus: protectedProcedure
    .input(z.object({ paperId: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);
      return getPaperKnowledgeStatus(input.paperId);
    }),

  syncNow: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        force: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      if (input.force) {
        await enqueuePaperForBackfill(input.paperId);
      }

      const result = await syncPaperKnowledge(input.paperId, {
        force: Boolean(input.force),
      });

      const status = await getPaperKnowledgeStatus(input.paperId);

      return {
        ...result,
        status,
      };
    }),
});
