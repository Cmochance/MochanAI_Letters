import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";

export const papersRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserPapers(ctx.user.id);
  }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const paper = await db.getPaperById(input.id);
      if (!paper || paper.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
      }
      return paper;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const paperId = await db.createPaper({
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
      });

      return { id: paperId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const paper = await db.getPaperById(input.id);
      if (!paper || paper.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
      }

      await db.updatePaper(input.id, {
        title: input.title,
        description: input.description,
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const paper = await db.getPaperById(input.id);
      if (!paper || paper.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
      }

      await db.deletePaper(input.id);
      return { success: true };
    }),
});
