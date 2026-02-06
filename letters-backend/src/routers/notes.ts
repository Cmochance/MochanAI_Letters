import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";

const categorySchema = z.enum([
  "inspiration",
  "character",
  "worldview",
  "plot",
  "other",
]);

export const notesRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserNotes(ctx.user.id);
  }),

  byCategory: protectedProcedure
    .input(z.object({ category: categorySchema }))
    .query(({ ctx, input }) => {
      return db.getNotesByCategory(ctx.user.id, input.category);
    }),

  byNovel: protectedProcedure
    .input(z.object({ novelId: z.number() }))
    .query(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Novel not found",
        });
      }
      return db.getUserNovelNotes(ctx.user.id, input.novelId);
    }),

  getById: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .query(({ ctx, input }) => {
      return db.getUserNoteById(ctx.user.id, input.noteId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        content: z.string(),
        category: categorySchema,
        novelId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Novel not found",
        });
      }

      const noteId = await db.createNote({
        userId: ctx.user.id,
        title: input.title,
        content: input.content,
        category: input.category,
        novelId: input.novelId,
      });
      return { id: noteId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        noteId: z.number(),
        title: z.string(),
        content: z.string(),
        category: categorySchema,
        novelId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existingNote = await db.getUserNoteById(ctx.user.id, input.noteId);
      if (!existingNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }

      const novel = await db.getNovelById(input.novelId);
      if (!novel || novel.userId !== ctx.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Novel not found",
        });
      }

      await db.updateNote(input.noteId, {
        title: input.title,
        content: input.content,
        category: input.category,
        novelId: input.novelId,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const existingNote = await db.getUserNoteById(ctx.user.id, input.noteId);
      if (!existingNote) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Note not found",
        });
      }

      await db.deleteNote(input.noteId);
      return { success: true };
    }),
});
