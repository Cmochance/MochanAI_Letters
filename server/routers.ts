import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { vectorizeChapter } from "./services/rag";
import { generateChapterOutline, expandChapterContent, countWords } from "./services/ai";
import { exportToTXT, exportToMarkdown, generateExportFilename } from "./services/export";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Novels management
  novels: router({
    list: protectedProcedure.query(({ ctx }) => db.getUserNovels(ctx.user.id)),
    
    create: protectedProcedure
      .input(z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const novelId = await db.createNovel({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
        });
        return { id: novelId };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteNovel(input.id)),
  }),
  
  // Chapters management
  chapters: router({
    list: protectedProcedure
      .input(z.object({ novelId: z.number() }))
      .query(({ input }) => db.getNovelChapters(input.novelId)),
    
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => db.getChapterById(input.id)),
    
    create: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
        title: z.string().min(1).max(255),
        content: z.string(),
      }))
      .mutation(async ({ input }) => {
        const wordCount = countWords(input.content);
        const chapterId = await db.createChapter({
          ...input,
          wordCount,
        });
        
        // Vectorize chapter in background
        vectorizeChapter(chapterId).catch((err) => {
          console.error("Failed to vectorize chapter:", err);
        });
        
        return { id: chapterId };
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const updateData: any = {};
        if (input.title) updateData.title = input.title;
        if (input.content) {
          updateData.content = input.content;
          updateData.wordCount = countWords(input.content);
        }
        
        await db.updateChapter(input.id, updateData);
        
        // Re-vectorize if content changed
        if (input.content) {
          vectorizeChapter(input.id).catch((err) => {
            console.error("Failed to vectorize chapter:", err);
          });
        }
        
        return { success: true };
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => db.deleteChapter(input.id)),
  }),
  
  // AI features
  ai: router({
    generateOutline: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        chapterNumber: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const settings = await db.getUserSettings(ctx.user.id);
        
        const outline = await generateChapterOutline(
          input.novelId,
          input.chapterNumber,
          settings?.apiKey || undefined,
          settings?.apiBaseUrl || undefined,
          settings?.modelName || undefined
        );
        
        return outline;
      }),
    
    expandContent: protectedProcedure
      .input(z.object({
        novelId: z.number(),
        outline: z.string(),
        targetWords: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const settings = await db.getUserSettings(ctx.user.id);
        
        const content = await expandChapterContent(
          input.novelId,
          input.outline,
          settings?.writingStyle || null,
          input.targetWords || 4000,
          settings?.apiKey || undefined,
          settings?.apiBaseUrl || undefined,
          settings?.modelName || undefined
        );
        
        return { content };
      }),
  }),
  
  // Export
  export: router({
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
        
        const filename = generateExportFilename(novel, "docx");
        return { content, filename };
      }),
  }),
  
  // User settings
  settings: router({
    get: protectedProcedure.query(({ ctx }) => db.getUserSettings(ctx.user.id)),
    
    update: protectedProcedure
      .input(z.object({
        apiKey: z.string().optional(),
        apiBaseUrl: z.string().optional(),
        modelName: z.string().optional(),
        writingStyle: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.upsertUserSettings({
          userId: ctx.user.id,
          ...input,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
