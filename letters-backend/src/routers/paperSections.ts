import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { countWords } from "../services/utils.js";
import { vectorizePaperSection } from "../services/rag.js";

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperSectionsRouter = router({
  list: protectedProcedure
    .input(z.object({ paperId: z.number() }))
    .query(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);
      return db.getPaperSections(input.paperId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const section = await db.getPaperSectionById(input.id);
      if (!section) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      }

      await ensurePaperOwner(ctx.user.id, section.paperId);
      return section;
    }),

  create: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        sectionNumber: z.number().min(1),
        title: z.string().min(1).max(255),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const wordCount = countWords(input.content);
      const sectionId = await db.createPaperSection({
        paperId: input.paperId,
        sectionNumber: input.sectionNumber,
        title: input.title,
        content: input.content,
        wordCount,
      });

      const settings = await db.getUserSettings(ctx.user.id);
      vectorizePaperSection(
        sectionId,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      ).catch((error) => {
        console.error("Failed to vectorize paper section", {
          sectionId,
          paperId: input.paperId,
          error,
        });
      });

      return { id: sectionId };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
        contentEn: z.string().optional(),
        figureCaptionZh: z.string().optional(),
        figureCaptionEn: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const section = await db.getPaperSectionById(input.id);
      if (!section) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      }

      await ensurePaperOwner(ctx.user.id, section.paperId);

      const updateData: Partial<{
        title: string;
        content: string;
        contentEn: string | null;
        figureCaptionZh: string | null;
        figureCaptionEn: string | null;
        wordCount: number;
      }> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.content !== undefined) {
        updateData.content = input.content;
        updateData.wordCount = countWords(input.content);
      }
      if (input.contentEn !== undefined) updateData.contentEn = input.contentEn;
      if (input.figureCaptionZh !== undefined)
        updateData.figureCaptionZh = input.figureCaptionZh;
      if (input.figureCaptionEn !== undefined)
        updateData.figureCaptionEn = input.figureCaptionEn;

      await db.updatePaperSection(input.id, updateData);

      if (input.content !== undefined || input.contentEn !== undefined) {
        const settings = await db.getUserSettings(ctx.user.id);
        vectorizePaperSection(
          input.id,
          settings?.embeddingApiKey || undefined,
          settings?.embeddingBaseUrl || undefined,
          settings?.embeddingModel || undefined
        ).catch((error) => {
          console.error("Failed to vectorize updated paper section", {
            sectionId: input.id,
            paperId: section.paperId,
            error,
          });
        });
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const section = await db.getPaperSectionById(input.id);
      if (!section) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Section not found" });
      }

      await ensurePaperOwner(ctx.user.id, section.paperId);
      await db.deletePaperSection(input.id);

      return { success: true };
    }),
});
