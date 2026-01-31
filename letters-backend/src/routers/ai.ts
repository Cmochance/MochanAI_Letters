import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { generateChapterOutline, expandChapterContent } from "../services/ai.js";
import {
  vectorizeChapter,
  vectorizeNovel,
  getNovelEmbeddingStats,
  searchRAGContext,
} from "../services/rag.js";

export const aiRouter = router({
  generateOutline: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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

      return outline;
    }),

  expandContent: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        outline: z.string(),
        targetWords: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await db.getUserSettings(ctx.user.id);

      const content = await expandChapterContent(
        input.novelId,
        input.outline,
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

  /**
   * Vectorize a single chapter for RAG
   */
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

  /**
   * Vectorize all chapters of a novel for RAG
   */
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

  /**
   * Get embedding statistics for a novel
   */
  getEmbeddingStats: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
      })
    )
    .query(async ({ input }) => {
      return getNovelEmbeddingStats(input.novelId);
    }),

  /**
   * Search for relevant content using RAG
   */
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
