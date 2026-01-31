import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  exportToTXT,
  exportToMarkdown,
  exportToEPub,
  generateExportFilename,
} from "../services/export.js";

export const exportRouter = router({
  txt: protectedProcedure
    .input(z.object({ novelId: z.number() }))
    .mutation(async ({ input }) => {
      const content = await exportToTXT(input.novelId);
      const novel = await db.getNovelById(input.novelId);
      if (!novel) throw new Error("Novel not found");

      const filename = generateExportFilename(novel, "txt");
      return { content, filename };
    }),

  markdown: protectedProcedure
    .input(z.object({ novelId: z.number() }))
    .mutation(async ({ input }) => {
      const content = await exportToMarkdown(input.novelId);
      const novel = await db.getNovelById(input.novelId);
      if (!novel) throw new Error("Novel not found");

      const timestamp = new Date().toISOString().split("T")[0];
      const sanitizedTitle = novel.title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
      const filename = `${sanitizedTitle}_${timestamp}.md`;
      return { content, filename };
    }),

  epub: protectedProcedure
    .input(z.object({ novelId: z.number() }))
    .mutation(async ({ input }) => {
      const buffer = await exportToEPub(input.novelId);
      const novel = await db.getNovelById(input.novelId);
      if (!novel) throw new Error("Novel not found");

      const filename = `${novel.title.replace(/[^\w\u4e00-\u9fa5]/g, "_")}_${
        new Date().toISOString().split("T")[0]
      }.epub`;

      // Convert buffer to base64 for transmission
      const base64 = buffer.toString("base64");
      return { content: base64, filename };
    }),
});
