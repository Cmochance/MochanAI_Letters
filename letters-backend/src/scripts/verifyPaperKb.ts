import "dotenv/config";
import * as db from "../db/queries.js";
import { buildEntityMarkdown, computeHash } from "../services/paperKnowledge.js";

async function main() {
  const papers = await db.getAllPapers();
  let total = 0;
  let mismatch = 0;
  let errors = 0;

  for (const paper of papers) {
    const items = await db.getPaperKbSyncItems(paper.id);
    for (const item of items) {
      total += 1;

      if (item.status === "error") {
        errors += 1;
      }

      const markdown = await buildEntityMarkdown({ item });
      if (!markdown) {
        continue;
      }

      const currentHash = computeHash(markdown);
      if (item.contentHash && item.contentHash !== currentHash) {
        mismatch += 1;
        console.log(
          `[verify] mismatch paper=${paper.id} item=${item.id} type=${item.entityType} lang=${item.lang}`
        );
      }
    }
  }

  console.log(
    `[verify] total=${total} mismatch=${mismatch} error=${errors}`
  );

  if (mismatch > 0 || errors > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error("[verify] failed", error);
  process.exit(1);
});
