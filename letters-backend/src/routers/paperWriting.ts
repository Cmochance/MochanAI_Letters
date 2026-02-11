import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { generatePaperWritingPart } from "../services/paperWriting.js";
import { enqueueSyncItems, ensureFreshBeforeGenerate } from "../services/paperKnowledge.js";

const partTypeSchema = z.enum([
  "body",
  "introduction",
  "conclusion",
  "abstract",
  "title",
]);

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperWritingRouter = router({
  getLatest: protectedProcedure
    .input(z.object({ paperId: z.number() }))
    .query(async ({ ctx, input }) => {
      const paper = await ensurePaperOwner(ctx.user.id, input.paperId);

      return {
        aiTitleZh: paper.aiTitleZh,
        aiTitleEn: paper.aiTitleEn,
        aiAbstractZh: paper.aiAbstractZh,
        aiAbstractEn: paper.aiAbstractEn,
        aiKeywordsZh: paper.aiKeywordsZh,
        aiKeywordsEn: paper.aiKeywordsEn,
        aiIntroductionZh: paper.aiIntroductionZh,
        aiIntroductionEn: paper.aiIntroductionEn,
        aiBodyZh: paper.aiBodyZh,
        aiBodyEn: paper.aiBodyEn,
        aiConclusionZh: paper.aiConclusionZh,
        aiConclusionEn: paper.aiConclusionEn,
      };
    }),

  generatePart: protectedProcedure
    .input(z.object({ paperId: z.number(), partType: partTypeSchema }))
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);
      await ensureFreshBeforeGenerate(input.paperId);
      const settings = await db.getUserSettings(ctx.user.id);

      const draft = await generatePaperWritingPart({
        paperId: input.paperId,
        partType: input.partType,
        userId: ctx.user.id,
        userSettings: settings,
      });

      return draft;
    }),

  savePart: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        partType: partTypeSchema,
        zh: z.string().min(1),
        en: z.string().min(1),
        keywordsZh: z.string().optional(),
        keywordsEn: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const update: Record<string, unknown> = {};

      if (input.partType === "title") {
        update.aiTitleZh = input.zh;
        update.aiTitleEn = input.en;
      } else if (input.partType === "abstract") {
        update.aiAbstractZh = input.zh;
        update.aiAbstractEn = input.en;
        update.aiKeywordsZh = input.keywordsZh || null;
        update.aiKeywordsEn = input.keywordsEn || null;
      } else if (input.partType === "introduction") {
        update.aiIntroductionZh = input.zh;
        update.aiIntroductionEn = input.en;
      } else if (input.partType === "body") {
        update.aiBodyZh = input.zh;
        update.aiBodyEn = input.en;
      } else if (input.partType === "conclusion") {
        update.aiConclusionZh = input.zh;
        update.aiConclusionEn = input.en;
      }

      await db.updatePaper(input.paperId, update as any);

      await enqueueSyncItems({
        paperId: input.paperId,
        partKeys: [input.partType],
      });

      return { success: true };
    }),
});
