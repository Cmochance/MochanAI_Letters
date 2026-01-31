import { router, publicProcedure } from "../trpc.js";
import { novelsRouter } from "./novels.js";
import { chaptersRouter } from "./chapters.js";
import { aiRouter } from "./ai.js";
import { notesRouter } from "./notes.js";
import { exportRouter } from "./export.js";
import { settingsRouter } from "./settings.js";
import { backupRouter } from "./backup.js";

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
});

export type AppRouter = typeof appRouter;
