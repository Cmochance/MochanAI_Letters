import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { isEmbeddingConfigured, getEmbeddingModel } from "../services/embedding.js";
import { isStorageConfigured } from "../services/storage.js";

export const settingsRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    return db.getUserSettings(ctx.user.id);
  }),

  update: protectedProcedure
    .input(
      z.object({
        // Chat completion API settings
        apiKey: z.string().optional(),
        apiBaseUrl: z.string().optional(),
        modelName: z.string().optional(),
        writingStyle: z.string().optional(),
        // Embedding API settings
        embeddingApiKey: z.string().optional(),
        embeddingBaseUrl: z.string().optional(),
        embeddingModel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.upsertUserSettings({
        userId: ctx.user.id,
        ...input,
      });
      return { success: true };
    }),

  /**
   * Get system configuration status
   * Returns information about which features are available
   */
  getSystemStatus: protectedProcedure.query(() => {
    return {
      // Embedding service status
      embeddingConfigured: isEmbeddingConfigured(),
      defaultEmbeddingModel: getEmbeddingModel(),
      // Storage service status
      storageConfigured: isStorageConfigured(),
    };
  }),
});
