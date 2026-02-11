import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import { countWords } from "../services/utils.js";
import { deleteFile, isStorageConfigured } from "../services/storage.js";
import { vectorizePaperSection } from "../services/rag.js";
import { enqueueSyncItems, ensureFreshBeforeGenerate } from "../services/paperKnowledge.js";
import {
  PAPER_DATA_TYPE_LABEL_ZH,
  analyzePaperFigure,
  classifyPaperFigure,
} from "../services/paperFigures.js";

const paperDataTypeSchema = z.enum([
  "line_chart",
  "bar_chart",
  "stacked_bar_chart",
  "scatter_plot",
  "histogram",
  "box_plot",
  "heatmap",
  "pie_chart",
  "table",
  "map",
  "other",
]);

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperFiguresRouter = router({
  analyze: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        figure: z.object({
          key: z.string().min(1),
          url: z.string().url(),
          contentType: z.string().min(1),
          filename: z.string().min(1),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);
      const freshness = await ensureFreshBeforeGenerate(input.paperId);

      const expectedPrefix = `paper-figures/${ctx.user.id}/${input.paperId}/`;
      if (!input.figure.key.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid figure key scope",
        });
      }

      const settings = await db.getUserSettings(ctx.user.id);

      const classification = await classifyPaperFigure(input.figure.url);
      const analysis = await analyzePaperFigure({
        paperId: input.paperId,
        classification,
        userSettings: settings,
      });

      const existing = await db.getPaperSectionByDataType(
        input.paperId,
        classification.dataType
      );

      return {
        dataType: classification.dataType,
        detailDescriptionZh: classification.detailDescriptionZh,
        mainFeatures: classification.mainFeatures,
        suggestedQueries: classification.suggestedQueries,
        analysisZh: analysis.analysisZh,
        analysisEn: analysis.analysisEn,
        captionZh: analysis.captionZh,
        captionEn: analysis.captionEn,
        existingSectionId: existing?.id ?? null,
        requiresConfirmReplace: Boolean(existing),
        webSearchEnabled: analysis.webSearchEnabled,
        providerUsed: analysis.providerUsed,
        sources: analysis.sources || [],
        knowledgeSyncState: freshness.state,
      };
    }),

  save: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        dataType: paperDataTypeSchema,
        contentZh: z.string().min(1),
        contentEn: z.string().min(1),
        captionZh: z.string().min(1),
        captionEn: z.string().min(1),
        figure: z.object({
          key: z.string().min(1),
          url: z.string().url(),
          contentType: z.string().min(1),
          filename: z.string().min(1),
        }),
        confirmReplace: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const expectedPrefix = `paper-figures/${ctx.user.id}/${input.paperId}/`;
      if (!input.figure.key.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid figure key scope",
        });
      }

      const existing = await db.getPaperSectionByDataType(
        input.paperId,
        input.dataType
      );

      const wordCount = countWords(input.contentZh);
      const title = PAPER_DATA_TYPE_LABEL_ZH[input.dataType] || "数据图";

      const settings = await db.getUserSettings(ctx.user.id);

      if (existing) {
        if (!input.confirmReplace) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "该数据类型的小节已存在，请确认替换",
          });
        }

        const oldKey = existing.figureKey;

        await db.updatePaperSection(existing.id, {
          title,
          content: input.contentZh,
          contentEn: input.contentEn,
          wordCount,
          dataType: input.dataType,
          figureKey: input.figure.key,
          figureUrl: input.figure.url,
          figureContentType: input.figure.contentType,
          figureFilename: input.figure.filename,
          figureCaptionZh: input.captionZh,
          figureCaptionEn: input.captionEn,
        });

        vectorizePaperSection(
          existing.id,
          settings?.embeddingApiKey || undefined,
          settings?.embeddingBaseUrl || undefined,
          settings?.embeddingModel || undefined
        ).catch((error) => {
          console.error("Failed to vectorize replaced paper section", {
            sectionId: existing.id,
            paperId: input.paperId,
            error,
          });
        });

        if (oldKey && oldKey !== input.figure.key && isStorageConfigured()) {
          deleteFile(oldKey).catch((error) => {
            console.error("Failed to delete old figure object", {
              oldKey,
              newKey: input.figure.key,
              error,
            });
          });
        }

        await enqueueSyncItems({
          paperId: input.paperId,
          sectionIds: [existing.id],
        });

        return { sectionId: existing.id, created: false };
      }

      const sections = await db.getPaperSections(input.paperId);
      const maxNumber = sections.reduce(
        (max, s) => Math.max(max, s.sectionNumber),
        0
      );
      const sectionNumber = maxNumber + 1;

      const sectionId = await db.createPaperSection({
        paperId: input.paperId,
        sectionNumber,
        title,
        content: input.contentZh,
        contentEn: input.contentEn,
        dataType: input.dataType,
        figureKey: input.figure.key,
        figureUrl: input.figure.url,
        figureContentType: input.figure.contentType,
        figureFilename: input.figure.filename,
        figureCaptionZh: input.captionZh,
        figureCaptionEn: input.captionEn,
        wordCount,
      });

      vectorizePaperSection(
        sectionId,
        settings?.embeddingApiKey || undefined,
        settings?.embeddingBaseUrl || undefined,
        settings?.embeddingModel || undefined
      ).catch((error) => {
        console.error("Failed to vectorize paper figure section", {
          sectionId,
          paperId: input.paperId,
          error,
        });
      });

      await enqueueSyncItems({
        paperId: input.paperId,
        sectionIds: [sectionId],
      });

      return { sectionId, created: true };
    }),
});
