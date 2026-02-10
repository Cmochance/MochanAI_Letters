import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  exportPaperToTXT,
  exportPaperToMarkdown,
  generatePaperExportFilename,
} from "../services/paperExport.js";
import { generatePaperDocx } from "../services/paperDocx.js";
import { uploadFile, isStorageConfigured } from "../services/storage.js";

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperExportRouter = router({
  txt: protectedProcedure
    .input(z.object({ paperId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const paper = await ensurePaperOwner(ctx.user.id, input.paperId);
      const content = await exportPaperToTXT(input.paperId);
      const filename = generatePaperExportFilename(paper, "txt");
      return { content, filename };
    }),

  markdown: protectedProcedure
    .input(z.object({ paperId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const paper = await ensurePaperOwner(ctx.user.id, input.paperId);
      const content = await exportPaperToMarkdown(input.paperId);
      const filename = generatePaperExportFilename(paper, "md");
      return { content, filename };
    }),

  docx: protectedProcedure
    .input(z.object({ paperId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const paper = await ensurePaperOwner(ctx.user.id, input.paperId);

      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 storage is not configured",
        });
      }

      const missing: string[] = [];
      const requiredFields: Array<[keyof typeof paper, string]> = [
        ["aiTitleZh", "ai_title_zh"],
        ["aiAbstractZh", "ai_abstract_zh"],
        ["aiIntroductionZh", "ai_introduction_zh"],
        ["aiBodyZh", "ai_body_zh"],
        ["aiConclusionZh", "ai_conclusion_zh"],
        ["aiTitleEn", "ai_title_en"],
        ["aiAbstractEn", "ai_abstract_en"],
        ["aiIntroductionEn", "ai_introduction_en"],
        ["aiBodyEn", "ai_body_en"],
        ["aiConclusionEn", "ai_conclusion_en"],
      ];

      for (const [field, label] of requiredFields) {
        const value = paper[field] as unknown;
        if (typeof value !== "string" || value.trim().length === 0) {
          missing.push(label);
        }
      }

      if (missing.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `导出前请先生成并保存以下内容：${missing.join(", ")}`,
        });
      }

      const figureSections = await db.getPaperFigureSections(input.paperId);
      const figures = figureSections
        .filter((s) => Boolean(s.dataType && s.figureKey))
        .map((s) => ({
          dataType: s.dataType!,
          key: s.figureKey!,
          contentType: s.figureContentType || null,
          captionZh: s.figureCaptionZh || null,
          captionEn: s.figureCaptionEn || null,
          fallbackTitle: s.title,
        }));

      const caches = {
        bufferCache: new Map<string, Buffer>(),
        dimensionCache: new Map<string, { width: number; height: number }>(),
      };

      const zhBuffer = await generatePaperDocx({
        lang: "zh",
        title: paper.aiTitleZh!,
        abstractText: paper.aiAbstractZh!,
        keywordsText: paper.aiKeywordsZh || "",
        introductionText: paper.aiIntroductionZh!,
        bodyText: paper.aiBodyZh!,
        conclusionText: paper.aiConclusionZh!,
        figures,
        caches,
      });

      const enBuffer = await generatePaperDocx({
        lang: "en",
        title: paper.aiTitleEn!,
        abstractText: paper.aiAbstractEn!,
        keywordsText: paper.aiKeywordsEn || "",
        introductionText: paper.aiIntroductionEn!,
        bodyText: paper.aiBodyEn!,
        conclusionText: paper.aiConclusionEn!,
        figures,
        caches,
      });

      const date = new Date().toISOString().split("T")[0];
      const safeTitle = paper.title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);

      const zhFilename = `${safeTitle}_${date}_zh.docx`;
      const enFilename = `${safeTitle}_${date}_en.docx`;
      const zhKey = `paper-exports/${ctx.user.id}/${input.paperId}/${ts}-${rand}-${zhFilename}`;
      const enKey = `paper-exports/${ctx.user.id}/${input.paperId}/${ts}-${rand}-${enFilename}`;

      const contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const zhUploaded = await uploadFile(zhKey, zhBuffer, contentType);
      const enUploaded = await uploadFile(enKey, enBuffer, contentType);

      return {
        zh: {
          downloadUrl: zhUploaded.url,
          filename: zhFilename,
        },
        en: {
          downloadUrl: enUploaded.url,
          filename: enFilename,
        },
      };
    }),
});
