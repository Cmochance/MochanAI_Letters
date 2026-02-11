import "dotenv/config";
import * as db from "../db/queries.js";
import { enqueuePaperForBackfill, syncPaperKnowledge } from "../services/paperKnowledge.js";

async function main() {
  const papers = await db.getAllPapers();
  console.log(`[backfill] papers: ${papers.length}`);

  for (const paper of papers) {
    console.log(`[backfill] enqueue paper=${paper.id}`);
    await enqueuePaperForBackfill(paper.id);

    const result = await syncPaperKnowledge(paper.id, {
      force: true,
      limit: 500,
    });

    console.log(
      `[backfill] synced paper=${paper.id} state=${result.state} processed=${result.processed}`
    );
  }

  console.log("[backfill] done");
}

main().catch((error) => {
  console.error("[backfill] failed", error);
  process.exit(1);
});
