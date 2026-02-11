import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { vectorizePaperNote } from "../services/rag.js";
import { enqueueNoteDelete, enqueueSyncItems } from "../services/paperKnowledge.js";

const paperNoteCategorySchema = z.enum([
  "research_question",
  "literature_review",
  "methodology",
  "data_experiment",
  "result_analysis",
  "discussion_limitations",
  "citations_todo",
]);

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperNotesRouter = router({
  byPaper: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);
      return db.getPaperNotes(input.paperId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        category: paperNoteCategorySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const noteId = await db.createPaperNote({
        userId: ctx.user.id,
        paperId: input.paperId,
        title: input.title,
        content: input.content,
        category: input.category,
      });

      const settings = await db.getUserSettings(ctx.user.id);
      vectorizePaperNote(
        noteId,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      ).catch((error) => {
        console.error("Failed to vectorize paper note", {
          noteId,
          paperId: input.paperId,
          error,
        });
      });

      await enqueueSyncItems({
        paperId: input.paperId,
        noteIds: [noteId],
      });

      return { id: noteId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        noteId: z.number(),
        paperId: z.number(),
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        category: paperNoteCategorySchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getPaperNoteById(ctx.user.id, input.noteId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      await ensurePaperOwner(ctx.user.id, input.paperId);

      await db.updatePaperNote(input.noteId, {
        paperId: input.paperId,
        title: input.title,
        content: input.content,
        category: input.category,
      });

      const settings = await db.getUserSettings(ctx.user.id);
      vectorizePaperNote(
        input.noteId,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      ).catch((error) => {
        console.error("Failed to vectorize updated paper note", {
          noteId: input.noteId,
          paperId: input.paperId,
          error,
        });
      });

      await enqueueSyncItems({
        paperId: input.paperId,
        noteIds: [input.noteId],
      });

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.getPaperNoteById(ctx.user.id, input.noteId);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Note not found" });
      }

      await enqueueNoteDelete(existing.paperId, existing.id);
      await db.deletePaperNote(input.noteId);
      return { success: true };
    }),
});
