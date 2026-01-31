import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { exportUserData, importUserData } from "../services/backup.js";

export const backupRouter = router({
  export: protectedProcedure.query(async ({ ctx }) => {
    const data = await exportUserData(ctx.user.id);
    return data;
  }),

  import: protectedProcedure
    .input(
      z.object({
        novels: z.array(z.any()),
        chapters: z.array(z.any()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await importUserData(ctx.user.id, input);
      return result;
    }),
});
