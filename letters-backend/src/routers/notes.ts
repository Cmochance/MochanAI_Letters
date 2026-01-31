import { z } from "zod";
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
    .query(({ input }) => {
      return db.getNovelNotes(input.novelId);
    }),

  getById: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .query(({ input }) => {
      return db.getNoteById(input.noteId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        content: z.string(),
        category: categorySchema,
        novelId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
        novelId: z.number().optional().nullable(),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateNote(input.noteId, {
        title: input.title,
        content: input.content,
        category: input.category,
        novelId: input.novelId ?? undefined,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ noteId: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteNote(input.noteId);
      return { success: true };
    }),
});
