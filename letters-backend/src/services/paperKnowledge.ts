import { createHash } from "node:crypto";
import * as db from "../db/queries.js";
import {
  deleteRagFile,
  ensurePaperCorpus,
  importRagFiles,
  isVertexRagConfigured,
  uploadPaperKnowledgeMarkdown,
} from "./vertexRag.js";

export type PaperPartKey =
  | "title"
  | "abstract"
  | "introduction"
  | "body"
  | "conclusion";

export type KnowledgeSyncState = "idle" | "syncing" | "error" | "disabled";

function normalizeText(value: string | null | undefined): string {
  return (value || "").trim();
}

function nonEmpty(value: string | null | undefined): boolean {
  return normalizeText(value).length > 0;
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function computeHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function getPartLangContent(paper: Awaited<ReturnType<typeof db.getPaperById>>, part: PaperPartKey, lang: "zh" | "en") {
  if (!paper) return "";
  if (part === "title") return lang === "zh" ? paper.aiTitleZh || "" : paper.aiTitleEn || "";
  if (part === "abstract") return lang === "zh" ? paper.aiAbstractZh || "" : paper.aiAbstractEn || "";
  if (part === "introduction") return lang === "zh" ? paper.aiIntroductionZh || "" : paper.aiIntroductionEn || "";
  if (part === "body") return lang === "zh" ? paper.aiBodyZh || "" : paper.aiBodyEn || "";
  return lang === "zh" ? paper.aiConclusionZh || "" : paper.aiConclusionEn || "";
}

export async function buildEntityMarkdown(input: {
  item: Awaited<ReturnType<typeof db.getPaperKbSyncItems>>[number];
}): Promise<string | null> {
  const { item } = input;

  if (item.entityType === "section") {
    if (!item.entityId) return null;
    const section = await db.getPaperSectionById(item.entityId);
    if (!section) return null;

    const content = item.lang === "zh" ? section.content : section.contentEn || "";
    const caption = item.lang === "zh" ? section.figureCaptionZh || "" : section.figureCaptionEn || "";

    if (!nonEmpty(content) && !nonEmpty(caption)) return null;

    return [
      `# ${section.title}`,
      "",
      content,
      "",
      caption ? `> ${caption}` : "",
      section.figureUrl ? `Source Image: ${section.figureUrl}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (item.entityType === "note") {
    if (!item.entityId || item.lang !== "zh") return null;
    const note = await db.getPaperNoteByIdUnsafe(item.entityId);
    if (!note || !nonEmpty(note.content)) return null;

    return [`# ${note.title}`, "", `Category: ${note.category}`, "", note.content]
      .filter(Boolean)
      .join("\n");
  }

  const paper = await db.getPaperById(item.paperId);
  if (!paper || !item.partKey) return null;

  const part = item.partKey as PaperPartKey;
  const value = getPartLangContent(paper, part, item.lang);
  if (!nonEmpty(value)) return null;

  return [`# Paper ${paper.id} ${part}`, "", value].join("\n");
}

async function upsertEntityItem(
  paperId: number,
  entityType: "section" | "note",
  entityId: number,
  lang: "zh" | "en",
  status: db.PaperKbSyncStatusValue
) {
  const row = await db.upsertPaperKbSyncItemForEntity({
    paperId,
    entityType,
    entityId,
    lang,
    status,
  });
  return row.id;
}

async function upsertPartItem(
  paperId: number,
  partKey: PaperPartKey,
  lang: "zh" | "en",
  status: db.PaperKbSyncStatusValue
) {
  const row = await db.upsertPaperKbSyncItemForPart({
    paperId,
    partKey,
    lang,
    status,
  });
  return row.id;
}

export async function enqueueSyncItems(input: {
  paperId: number;
  sectionIds?: number[];
  noteIds?: number[];
  partKeys?: PaperPartKey[];
}) {
  const ids: number[] = [];

  for (const sectionId of input.sectionIds || []) {
    ids.push(await upsertEntityItem(input.paperId, "section", sectionId, "zh", "pending"));
    ids.push(await upsertEntityItem(input.paperId, "section", sectionId, "en", "pending"));
  }

  for (const noteId of input.noteIds || []) {
    ids.push(await upsertEntityItem(input.paperId, "note", noteId, "zh", "pending"));
    ids.push(await upsertEntityItem(input.paperId, "note", noteId, "en", "delete_pending"));
  }

  for (const partKey of input.partKeys || []) {
    ids.push(await upsertPartItem(input.paperId, partKey, "zh", "pending"));
    ids.push(await upsertPartItem(input.paperId, partKey, "en", "pending"));
  }

  return ids;
}

export async function enqueueSectionDelete(paperId: number, sectionId: number) {
  await db.markPaperKbEntityDeletePending(paperId, "section", sectionId);
}

export async function enqueueNoteDelete(paperId: number, noteId: number) {
  await db.markPaperKbEntityDeletePending(paperId, "note", noteId);
}

async function processSyncItem(
  item: Awaited<ReturnType<typeof db.getPaperKbSyncItems>>[number],
  force = false
) {
  await db.updatePaperKbSyncItem(item.id, {
    status: "syncing",
    lastError: null,
  });

  try {
    if (item.status === "delete_pending") {
      if (item.ragFileName) {
        await deleteRagFile(item.ragFileName);
      }
      await db.deletePaperKbSyncItem(item.id);
      return;
    }

    const markdown = await buildEntityMarkdown({ item });
    if (!markdown) {
      if (item.ragFileName) {
        await deleteRagFile(item.ragFileName);
      }
      await db.deletePaperKbSyncItem(item.id);
      return;
    }

    const hash = computeHash(markdown);
    if (!force && item.status === "synced" && item.contentHash === hash && item.ragFileName) {
      await db.updatePaperKbSyncItem(item.id, {
        status: "synced",
        lastError: null,
      });
      return;
    }

    const corpusName = await ensurePaperCorpus(item.paperId);
    if (!corpusName) {
      throw new Error("Vertex corpus is not configured");
    }

    const gcsUri = await uploadPaperKnowledgeMarkdown({
      paperId: item.paperId,
      itemId: item.id,
      lang: item.lang,
      filenamePrefix: `${item.entityType}-${item.entityId || item.partKey || "unknown"}`,
      content: markdown,
    });

    if (item.ragFileName) {
      await deleteRagFile(item.ragFileName);
    }

    const imported = await importRagFiles({
      paperId: item.paperId,
      corpusName,
      gcsUri,
    });

    await db.updatePaperKbSyncItem(item.id, {
      status: "synced",
      gcsUri,
      contentHash: hash,
      ragFileName: imported.ragFileName || item.ragFileName || null,
      lastError: null,
      retryCount: 0,
    });
  } catch (error) {
    await db.updatePaperKbSyncItem(item.id, {
      status: "error",
      retryCount: (item.retryCount || 0) + 1,
      lastError: asErrorMessage(error),
    });
  }
}

export async function syncPaperKnowledge(
  paperId: number,
  options?: { force?: boolean; limit?: number }
): Promise<{ state: KnowledgeSyncState; processed: number }> {
  if (!isVertexRagConfigured()) {
    return { state: "disabled", processed: 0 };
  }

  const locked = await db.tryAcquirePaperKbLock(paperId);
  if (!locked) {
    const status = await db.getPaperKbSyncStatusSummary(paperId);
    return {
      state: status.state,
      processed: 0,
    };
  }

  let processed = 0;
  try {
    const candidates = await db.listPaperKbSyncItemsByStatus(
      paperId,
      options?.force
        ? ["pending", "syncing", "error", "delete_pending", "synced"]
        : ["pending", "error", "delete_pending"],
      options?.limit ?? 200
    );

    for (const item of candidates.reverse()) {
      await processSyncItem(item, Boolean(options?.force));
      processed += 1;
    }

    await db.updatePaper(paperId, {
      vertexLastSyncAt: new Date(),
    });

    const status = await db.getPaperKbSyncStatusSummary(paperId);
    return {
      state: status.state,
      processed,
    };
  } finally {
    await db.releasePaperKbLock(paperId);
  }
}

export async function ensureFreshBeforeGenerate(
  paperId: number
): Promise<{ state: KnowledgeSyncState }> {
  if (!isVertexRagConfigured()) {
    return { state: "disabled" };
  }

  const status = await db.getPaperKbSyncStatusSummary(paperId);
  if (status.state === "syncing" || status.state === "error") {
    const result = await syncPaperKnowledge(paperId);
    return { state: result.state };
  }

  return { state: status.state };
}

export async function getPaperKnowledgeStatus(paperId: number) {
  const summary = await db.getPaperKbSyncStatusSummary(paperId);
  const items = await db.getPaperKbSyncItems(paperId);

  return {
    state: isVertexRagConfigured() ? summary.state : "disabled",
    summary: summary.summary,
    items,
  };
}

export async function enqueuePaperForBackfill(paperId: number) {
  const sections = await db.getPaperSections(paperId);
  const notes = await db.getPaperNotes(paperId);

  await enqueueSyncItems({
    paperId,
    sectionIds: sections.map((s) => s.id),
    noteIds: notes.map((n) => n.id),
    partKeys: ["title", "abstract", "introduction", "body", "conclusion"],
  });
}
