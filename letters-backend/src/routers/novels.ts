import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { generateNovelCover } from "../services/cover.js";

export const novelsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return db.getUserNovels(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const novelId = await db.createNovel({
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
      });

      let coverUrl: string | undefined;
      try {
        const result = await generateNovelCover({
          title: input.title,
          description: input.description,
          novelId,
          userId: ctx.user.id,
        });
        coverUrl = result.imageUrl;
        await db.updateNovel(novelId, { coverUrl });
      } catch (error) {
        console.error("Auto cover generation failed:", error);
      }

      return { id: novelId, coverUrl };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteNovel(input.id);
      return { success: true };
    }),

  generateCover: protectedProcedure
    .input(
      z.object({
        novelId: z.number(),
        title: z.string(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { imageUrl } = await generateNovelCover({
        title: input.title,
        description: input.description,
        novelId: input.novelId,
        userId: ctx.user.id,
      });

      // Update novel with cover URL
      await db.updateNovel(input.novelId, { coverUrl: imageUrl });

      return { coverUrl: imageUrl };
    }),
});
