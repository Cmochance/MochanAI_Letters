import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  exportPaperToTXT,
  exportPaperToMarkdown,
  generatePaperExportFilename,
} from "../services/paperExport.js";

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
});
