import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import * as db from "../db/queries.js";
import {
  deleteFile,
  getPublicUrl,
  getUploadUrl,
  isStorageConfigured,
} from "../services/storage.js";

function generatePaperFigureKey(options: {
  userId: number;
  paperId: number;
  filename: string;
}): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = options.filename.split(".").pop() || "";
  const safeName = options.filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .substring(0, 50);

  const normalizedExt = ext ? `.${ext}` : "";
  return `paper-figures/${options.userId}/${options.paperId}/${timestamp}-${random}-${safeName}${normalizedExt}`;
}

async function ensurePaperOwner(userId: number, paperId: number) {
  const paper = await db.getPaperById(paperId);
  if (!paper || paper.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Paper not found" });
  }
  return paper;
}

export const paperFilesRouter = router({
  getFigureUploadUrl: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        contentType: z.string().min(1),
        filename: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 storage is not configured",
        });
      }

      const key = generatePaperFigureKey({
        userId: ctx.user.id,
        paperId: input.paperId,
        filename: input.filename,
      });

      const uploadUrl = await getUploadUrl(key, input.contentType, 3600);
      const publicUrl = getPublicUrl(key);
      return { key, uploadUrl, publicUrl };
    }),

  deleteObject: protectedProcedure
    .input(
      z.object({
        paperId: z.number(),
        key: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ensurePaperOwner(ctx.user.id, input.paperId);

      const expectedPrefix = `paper-figures/${ctx.user.id}/${input.paperId}/`;
      if (!input.key.startsWith(expectedPrefix)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid object key scope",
        });
      }

      if (!isStorageConfigured()) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "R2 storage is not configured",
        });
      }

      await deleteFile(input.key);
      return { success: true };
    }),
});

