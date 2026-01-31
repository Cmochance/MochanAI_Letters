import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { countWords } from "../services/utils.js";
import { vectorizeChapter } from "../services/rag.js";

export const chaptersRouter = router({
  list: protectedProcedure
    .input(z.object({ novelId: z.number() }))
    .query(({ input }) => {
      return db.getNovelChapters(input.novelId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => {
      return db.getChapterById(input.id);
    }),

  create: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        title: z.string().min(1).max(255),
        content: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const wordCount = countWords(input.content);
      const chapterId = await db.createChapter({
        ...input,
        wordCount,
      });

      // Vectorize chapter in background
      vectorizeChapter(chapterId).catch((err) => {
        console.error("Failed to vectorize chapter:", err);
      });

      return { id: chapterId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.title) updateData.title = input.title;
      if (input.content) {
        updateData.content = input.content;
        updateData.wordCount = countWords(input.content);
      }

      await db.updateChapter(input.id, updateData);

      // Re-vectorize if content changed
      if (input.content) {
        vectorizeChapter(input.id).catch((err) => {
          console.error("Failed to vectorize chapter:", err);
        });
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteChapter(input.id);
      return { success: true };
    }),
});
