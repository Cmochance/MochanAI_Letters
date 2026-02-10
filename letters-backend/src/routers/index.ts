import { router, publicProcedure } from "../trpc.js";
import { novelsRouter } from "./novels.js";
import { chaptersRouter } from "./chapters.js";
import { aiRouter } from "./ai.js";
import { notesRouter } from "./notes.js";
import { exportRouter } from "./export.js";
import { settingsRouter } from "./settings.js";
import { backupRouter } from "./backup.js";
import { plansRouter } from "./plans.js";
import { papersRouter } from "./papers.js";
import { paperSectionsRouter } from "./paperSections.js";
import { paperNotesRouter } from "./paperNotes.js";
import { paperAiRouter } from "./paperAi.js";
import { paperExportRouter } from "./paperExport.js";
import { paperFilesRouter } from "./paperFiles.js";
import { paperFiguresRouter } from "./paperFigures.js";
import { paperWritingRouter } from "./paperWriting.js";

export const appRouter = router({
  // System routes
  system: router({
    health: publicProcedure.query(() => ({
      ok: true,
      timestamp: Date.now(),
    })),
  }),

  // Auth routes
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
  }),

  // Feature routes
  novels: novelsRouter,
  chapters: chaptersRouter,
  ai: aiRouter,
  notes: notesRouter,
  export: exportRouter,
  settings: settingsRouter,
  backup: backupRouter,
  plans: plansRouter,
  papers: papersRouter,
  paperSections: paperSectionsRouter,
  paperNotes: paperNotesRouter,
  paperAi: paperAiRouter,
  paperExport: paperExportRouter,
  paperFiles: paperFilesRouter,
  paperFigures: paperFiguresRouter,
  paperWriting: paperWritingRouter,
});

export type AppRouter = typeof appRouter;
