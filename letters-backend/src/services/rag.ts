import * as db from "../db/queries.js";
import {
  generateEmbedding,
  batchGenerateEmbeddings,
  isEmbeddingConfigured,
} from "./embedding.js";
import {
  ensurePaperCorpus,
  isVertexRagConfigured,
  retrieveContexts,
  type VertexContextSource,
} from "./vertexRag.js";

/**
 * RAG (Retrieval-Augmented Generation) Service
 * Provides context-aware content retrieval for AI-assisted writing
 */

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_CHUNK_OVERLAP = 100;
const MIN_CONTENT_LENGTH = 100;
const MAX_CONTEXT_CHARS = 2200;
const DEFAULT_RAG_SIMILARITY_THRESHOLD = 0.45;
const EARLY_OUTLINE_RAG_SIMILARITY_THRESHOLD = 0.35;
const EARLY_OUTLINE_CONTEXT_LIMIT = 3;
const EARLY_OUTLINE_RAG_FALLBACK_LIMIT = 2;

const NOVEL_NOTE_CATEGORY_LABELS: Record<db.NoteCategoryValue, string> = {
  inspiration: "灵感",
  character: "人物",
  worldview: "世界观",
  plot: "情节",
  other: "其他",
};

const PAPER_NOTE_CATEGORY_LABELS: Record<db.PaperNoteCategoryValue, string> = {
  research_question: "研究问题",
  literature_review: "文献综述",
  methodology: "方法设计",
  data_experiment: "数据与实验",
  result_analysis: "结果分析",
  discussion_limitations: "讨论与局限",
  citations_todo: "引文待补",
};

const NOVEL_OUTLINE_NOTE_PRIORITY: db.NoteCategoryValue[] = [
  "plot",
  "character",
  "worldview",
  "inspiration",
  "other",
];

const NOVEL_EXPAND_NOTE_PRIORITY: db.NoteCategoryValue[] = [
  "plot",
  "character",
  "inspiration",
  "worldview",
  "other",
];

const PAPER_OUTLINE_NOTE_PRIORITY: db.PaperNoteCategoryValue[] = [
  "research_question",
  "literature_review",
  "methodology",
  "data_experiment",
  "result_analysis",
  "discussion_limitations",
  "citations_todo",
];

const PAPER_EXPAND_NOTE_PRIORITY: db.PaperNoteCategoryValue[] = [
  "methodology",
  "data_experiment",
  "result_analysis",
  "literature_review",
  "discussion_limitations",
  "research_question",
  "citations_todo",
];

function truncateContext(text: string, maxChars: number = MAX_CONTEXT_CHARS) {
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}...` : text;
}

export function splitTextIntoChunks(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (!text || text.length < MIN_CONTENT_LENGTH) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const breakPoints = [". ", "。", "！", "？", "\n\n", "\n"];
      let bestBreak = -1;

      for (const bp of breakPoints) {
        const idx = text.lastIndexOf(bp, end);
        if (idx > start + chunkSize / 2) {
          bestBreak = idx + bp.length;
          break;
        }
      }

      if (bestBreak > start) {
        end = bestBreak;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

function hasEmbeddingRuntime(userApiKey?: string): boolean {
  return isEmbeddingConfigured() || Boolean(userApiKey);
}

// ============ Novel Embeddings ============

export async function vectorizeChapter(
  chapterId: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<{ chunksCreated: number }> {
  if (!hasEmbeddingRuntime(userApiKey)) {
    console.warn("Embedding API not configured, skipping chapter vectorization");
    return { chunksCreated: 0 };
  }

  const chapter = await db.getChapterById(chapterId);
  if (!chapter) {
    throw new Error(`Chapter ${chapterId} not found`);
  }

  if (chapter.content.length < MIN_CONTENT_LENGTH) {
    return { chunksCreated: 0 };
  }

  await db.deleteChapterEmbeddings(chapterId);

  const chunks = splitTextIntoChunks(chapter.content);
  if (chunks.length === 0) {
    return { chunksCreated: 0 };
  }

  const embeddings = await batchGenerateEmbeddings(
    chunks,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const embeddingData = chunks.map((chunk, index) => ({
    chapterId: chapter.id,
    novelId: chapter.novelId,
    contentChunk: chunk,
    embedding: embeddings[index],
    chunkIndex: index,
  }));

  await db.createChapterEmbeddingsBatch(embeddingData);

  return { chunksCreated: chunks.length };
}

export async function vectorizeNovel(
  novelId: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<{ totalChunks: number; chaptersProcessed: number }> {
  const chapters = await db.getNovelChapters(novelId);
  let totalChunks = 0;
  let chaptersProcessed = 0;

  for (const chapter of chapters) {
    try {
      const result = await vectorizeChapter(
        chapter.id,
        userApiKey,
        userBaseUrl,
        userModel
      );
      totalChunks += result.chunksCreated;
      if (result.chunksCreated > 0) {
        chaptersProcessed += 1;
      }
    } catch (error) {
      console.error(`Failed to vectorize chapter ${chapter.id}:`, error);
    }
  }

  return { totalChunks, chaptersProcessed };
}

export async function vectorizeNote(
  noteId: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<{ chunksCreated: number }> {
  if (!hasEmbeddingRuntime(userApiKey)) {
    console.warn("Embedding API not configured, skipping note vectorization");
    return { chunksCreated: 0 };
  }

  const note = await db.getNoteById(noteId);
  if (!note || !note.novelId) {
    return { chunksCreated: 0 };
  }

  const embeddingSource = `${note.title}\n${note.content}`;
  if (embeddingSource.length < MIN_CONTENT_LENGTH) {
    await db.deleteNoteEmbeddings(note.id);
    return { chunksCreated: 0 };
  }

  await db.deleteNoteEmbeddings(note.id);

  const chunks = splitTextIntoChunks(embeddingSource);
  if (chunks.length === 0) {
    return { chunksCreated: 0 };
  }

  const embeddings = await batchGenerateEmbeddings(
    chunks,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const payload = chunks.map((chunk, index) => ({
    userId: note.userId,
    noteId: note.id,
    novelId: note.novelId!,
    category: note.category,
    contentChunk: chunk,
    embedding: embeddings[index],
    chunkIndex: index,
  }));

  await db.createNoteEmbeddingsBatch(payload);

  return { chunksCreated: chunks.length };
}

// ============ Paper Embeddings ============

export async function vectorizePaperSection(
  sectionId: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<{ chunksCreated: number }> {
  if (!hasEmbeddingRuntime(userApiKey)) {
    console.warn("Embedding API not configured, skipping paper section vectorization");
    return { chunksCreated: 0 };
  }

  const section = await db.getPaperSectionById(sectionId);
  if (!section) {
    throw new Error(`Paper section ${sectionId} not found`);
  }

  const embeddingSource = [
    section.title,
    section.content,
    section.contentEn,
    section.figureCaptionZh,
    section.figureCaptionEn,
  ]
    .filter(Boolean)
    .join("\n");
  if (embeddingSource.length < MIN_CONTENT_LENGTH) {
    await db.deletePaperSectionEmbeddings(section.id);
    return { chunksCreated: 0 };
  }

  await db.deletePaperSectionEmbeddings(section.id);

  const chunks = splitTextIntoChunks(embeddingSource);
  if (chunks.length === 0) {
    return { chunksCreated: 0 };
  }

  const embeddings = await batchGenerateEmbeddings(
    chunks,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const payload = chunks.map((chunk, index) => ({
    sectionId: section.id,
    paperId: section.paperId,
    contentChunk: chunk,
    embedding: embeddings[index],
    chunkIndex: index,
  }));

  await db.createPaperSectionEmbeddingsBatch(payload);
  return { chunksCreated: chunks.length };
}

export async function vectorizePaperNote(
  noteId: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<{ chunksCreated: number }> {
  if (!hasEmbeddingRuntime(userApiKey)) {
    console.warn("Embedding API not configured, skipping paper note vectorization");
    return { chunksCreated: 0 };
  }

  const note = await db.getPaperNoteByIdUnsafe(noteId);
  if (!note) {
    return { chunksCreated: 0 };
  }

  const source = `${note.title}\n${note.content}`;
  if (source.length < MIN_CONTENT_LENGTH) {
    await db.deletePaperNoteEmbeddings(note.id);
    return { chunksCreated: 0 };
  }

  await db.deletePaperNoteEmbeddings(note.id);

  const chunks = splitTextIntoChunks(source);
  if (chunks.length === 0) {
    return { chunksCreated: 0 };
  }

  const embeddings = await batchGenerateEmbeddings(
    chunks,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const payload = chunks.map((chunk, index) => ({
    userId: note.userId,
    noteId: note.id,
    paperId: note.paperId,
    category: note.category,
    contentChunk: chunk,
    embedding: embeddings[index],
    chunkIndex: index,
  }));

  await db.createPaperNoteEmbeddingsBatch(payload);
  return { chunksCreated: chunks.length };
}

// ============ Novel Context Retrieval ============

export async function searchRAGContext(
  novelId: number,
  query: string,
  limit: number = 5,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<Array<{ content: string; similarity: number; chapterId: number }>> {
  if (!hasEmbeddingRuntime(userApiKey)) {
    return [];
  }

  const embeddingCount = await db.getEmbeddingCount(novelId);
  if (embeddingCount === 0) {
    return [];
  }

  const queryEmbedding = await generateEmbedding(
    query,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const results = await db.searchSimilarChunks(novelId, queryEmbedding, limit);

  return results.map((r) => ({
    content: r.content_chunk,
    similarity: r.similarity,
    chapterId: r.chapter_id,
  }));
}

export async function searchNovelNoteContext(
  novelId: number,
  query: string,
  limit: number = 6,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<
  Array<{
    content: string;
    similarity: number;
    category: db.NoteCategoryValue;
    noteId: number;
  }>
> {
  if (!hasEmbeddingRuntime(userApiKey)) {
    return [];
  }

  const embeddingCount = await db.getNovelNoteEmbeddingCount(novelId);
  if (embeddingCount === 0) {
    return [];
  }

  const queryEmbedding = await generateEmbedding(
    query,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const results = await db.searchSimilarNoteChunks(novelId, queryEmbedding, limit);

  return results.map((row) => ({
    content: row.content_chunk,
    similarity: row.similarity,
    category: row.category,
    noteId: row.note_id,
  }));
}

async function buildStructuredNovelNotesContext(
  novelId: number,
  categories: db.NoteCategoryValue[],
  limitPerCategory: number = 3
): Promise<string> {
  const categoryLines: string[] = [];

  for (const category of categories) {
    const notes = await db.getNovelNotesByCategory(novelId, category, limitPerCategory);
    if (notes.length === 0) {
      continue;
    }

    categoryLines.push(`【${NOVEL_NOTE_CATEGORY_LABELS[category]}】`);
    for (const note of notes) {
      categoryLines.push(`- ${note.title}: ${truncateContext(note.content, 180)}`);
    }
  }

  return categoryLines.join("\n");
}

type NovelPlanSummary = {
  sectionNumber: number;
  chapterId: number | null;
  chapterTitle: string | null;
  version: number;
  theme: string;
  framework: string;
  conflicts: string;
  interactions: string;
};

function summarizeNarrative(text: string, maxChars: number = 500): string {
  const normalized = text.trim();
  if (!normalized) return "";
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}...` : normalized;
}

function buildNovelPlanSummary(plan: NovelPlanSummary): string {
  const lines = [
    `主题：${plan.theme}`,
    `框架：${plan.framework}`,
    `冲突：${plan.conflicts}`,
    `互动：${plan.interactions}`,
  ];
  return summarizeNarrative(lines.join("；"), 520);
}

function buildNovelRagQuery(params: {
  chapterNumber: number;
  query?: string;
  recentChapters: Array<{ title: string; summary?: string; content: string }>;
}): string {
  const baseQuery =
    params.query?.trim() ||
    `第${params.chapterNumber}章 情节发展 人物关系 冲突 灵感`;

  const narrativeContext = params.recentChapters
    .map((chapter) => {
      const summary = summarizeNarrative(chapter.summary || chapter.content, 180);
      if (!summary) return "";
      return `${chapter.title}：${summary}`;
    })
    .filter(Boolean)
    .join("；");

  if (!narrativeContext) {
    return baseQuery;
  }

  return `${baseQuery}\n前文剧情总结：${summarizeNarrative(narrativeContext, 900)}`;
}

function pickRelevantBySimilarity<T extends { similarity: number }>(
  results: T[],
  threshold: number,
  fallbackLimit: number
): T[] {
  const matched = results.filter((row) => row.similarity >= threshold);
  if (matched.length > 0) {
    return matched;
  }

  if (fallbackLimit > 0) {
    return results.slice(0, fallbackLimit);
  }

  return [];
}

export async function getAIContext(
  novelId: number,
  chapterNumber: number,
  options?: {
    query?: string;
    recentCount?: number;
    ragLimit?: number;
    noteRagLimit?: number;
    noteCategories?: db.NoteCategoryValue[];
    phase?: "outline" | "expand";
    userApiKey?: string;
    userBaseUrl?: string;
    userModel?: string;
  }
): Promise<{
  ragContext: string;
  noteRagContext: string;
  structuredNotesContext: string;
  recentChapters: Array<{
    number: number;
    title: string;
    content: string;
    summary?: string;
  }>;
  hasEmbeddings: boolean;
}> {
  const {
    query,
    recentCount = 3,
    ragLimit = 5,
    noteRagLimit = 6,
    noteCategories,
    phase = "outline",
    userApiKey,
    userBaseUrl,
    userModel,
  } = options || {};

  const isEarlyOutline = phase === "outline" && chapterNumber <= EARLY_OUTLINE_CONTEXT_LIMIT;
  const contextLimit = isEarlyOutline
    ? Math.max(recentCount, EARLY_OUTLINE_CONTEXT_LIMIT)
    : recentCount;

  const allRecentChapters = await db.getRecentChapters(novelId, contextLimit + 2);
  const chapterCandidates = allRecentChapters
    .filter((ch) => ch.chapterNumber < chapterNumber)
    .slice(0, contextLimit)
    .map((ch) => ({
      number: ch.chapterNumber,
      title: ch.title,
      content: ch.content,
      summary: summarizeNarrative(ch.content, 500),
    }));

  const planCandidates: NovelPlanSummary[] = await db.getRecentNovelPlanSummaries(
    novelId,
    chapterNumber,
    contextLimit
  );

  const chapterByNumber = new Map(chapterCandidates.map((chapter) => [chapter.number, chapter]));
  const planByNumber = new Map(planCandidates.map((plan) => [plan.sectionNumber, plan]));

  const mergedNumbers = Array.from(
    new Set([...chapterByNumber.keys(), ...planByNumber.keys()])
  )
    .filter((number) => number < chapterNumber)
    .sort((a, b) => b - a)
    .slice(0, contextLimit);

  const recentChapters = mergedNumbers
    .map((number) => {
      const chapter = chapterByNumber.get(number);
      const plan = planByNumber.get(number);

      const summary = plan
        ? buildNovelPlanSummary(plan)
        : summarizeNarrative(chapter?.summary || chapter?.content || "", 500);

      if (!chapter && !summary) {
        return null;
      }

      return {
        number,
        title: chapter?.title || plan?.chapterTitle || `第 ${number} 章`,
        content: chapter?.content || "",
        summary,
      };
    })
    .filter(
      (
        chapter
      ): chapter is {
        number: number;
        title: string;
        content: string;
        summary?: string;
      } => chapter !== null
    );

  const effectiveQuery = buildNovelRagQuery({
    chapterNumber,
    query,
    recentChapters,
  });

  const ragSimilarityThreshold = isEarlyOutline
    ? EARLY_OUTLINE_RAG_SIMILARITY_THRESHOLD
    : DEFAULT_RAG_SIMILARITY_THRESHOLD;
  const ragFallbackLimit = isEarlyOutline ? EARLY_OUTLINE_RAG_FALLBACK_LIMIT : 0;

  const selectedCategories =
    noteCategories ||
    (phase === "expand" ? NOVEL_EXPAND_NOTE_PRIORITY : NOVEL_OUTLINE_NOTE_PRIORITY);

  const structuredNotesContext = await buildStructuredNovelNotesContext(
    novelId,
    selectedCategories,
    3
  );

  const chapterEmbeddingCount = await db.getEmbeddingCount(novelId);
  const noteEmbeddingCount = await db.getNovelNoteEmbeddingCount(novelId);
  const hasEmbeddings = chapterEmbeddingCount + noteEmbeddingCount > 0;

  let ragContext = "";
  if (effectiveQuery && chapterEmbeddingCount > 0) {
    try {
      const ragResults = await searchRAGContext(
        novelId,
        effectiveQuery,
        ragLimit,
        userApiKey,
        userBaseUrl,
        userModel
      );

      ragContext = pickRelevantBySimilarity(
        ragResults,
        ragSimilarityThreshold,
        ragFallbackLimit
      )
        .map((r) => truncateContext(r.content, 350))
        .join("\n\n---\n\n");
    } catch (error) {
      console.error("Novel chapter RAG search failed:", error);
    }
  }

  let noteRagContext = "";
  if (effectiveQuery && noteEmbeddingCount > 0) {
    try {
      const noteResults = await searchNovelNoteContext(
        novelId,
        effectiveQuery,
        noteRagLimit,
        userApiKey,
        userBaseUrl,
        userModel
      );

      noteRagContext = pickRelevantBySimilarity(
        noteResults,
        ragSimilarityThreshold,
        ragFallbackLimit
      )
        .map(
          (r) =>
            `[${NOVEL_NOTE_CATEGORY_LABELS[r.category]}] ${truncateContext(
              r.content,
              240
            )}`
        )
        .join("\n");
    } catch (error) {
      console.error("Novel note RAG search failed:", error);
    }
  }

  return {
    ragContext,
    noteRagContext,
    structuredNotesContext,
    recentChapters,
    hasEmbeddings,
  };
}

// ============ Paper Context Retrieval ============

async function buildStructuredPaperNotesContext(
  paperId: number,
  categories: db.PaperNoteCategoryValue[],
  limitPerCategory: number = 3
): Promise<string> {
  const lines: string[] = [];

  for (const category of categories) {
    const notes = await db.getPaperNotesByCategory(paperId, category, limitPerCategory);
    if (notes.length === 0) {
      continue;
    }

    lines.push(`【${PAPER_NOTE_CATEGORY_LABELS[category]}】`);
    for (const note of notes) {
      lines.push(`- ${note.title}: ${truncateContext(note.content, 180)}`);
    }
  }

  return lines.join("\n");
}

async function searchPaperSectionContext(
  paperId: number,
  query: string,
  limit: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
) {
  if (!hasEmbeddingRuntime(userApiKey)) {
    return [] as Array<{ content: string; similarity: number }>;
  }

  const embeddingCount = await db.getPaperSectionEmbeddingCount(paperId);
  if (embeddingCount === 0) {
    return [] as Array<{ content: string; similarity: number }>;
  }

  const queryEmbedding = await generateEmbedding(
    query,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const results = await db.searchSimilarPaperSectionChunks(
    paperId,
    queryEmbedding,
    limit
  );

  return results.map((r) => ({
    content: r.content_chunk,
    similarity: r.similarity,
  }));
}

async function searchPaperNoteContext(
  paperId: number,
  query: string,
  limit: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
) {
  if (!hasEmbeddingRuntime(userApiKey)) {
    return [] as Array<{
      content: string;
      similarity: number;
      category: db.PaperNoteCategoryValue;
    }>;
  }

  const embeddingCount = await db.getPaperNoteEmbeddingCount(paperId);
  if (embeddingCount === 0) {
    return [] as Array<{
      content: string;
      similarity: number;
      category: db.PaperNoteCategoryValue;
    }>;
  }

  const queryEmbedding = await generateEmbedding(
    query,
    userApiKey,
    userBaseUrl,
    userModel
  );

  const results = await db.searchSimilarPaperNoteChunks(paperId, queryEmbedding, limit);
  return results.map((r) => ({
    content: r.content_chunk,
    similarity: r.similarity,
    category: r.category,
  }));
}

export type PaperKnowledgeProvider = "pgvector" | "vertex" | "hybrid";

export interface PaperContextSource {
  provider: "vertex" | "pgvector";
  title?: string;
  uri?: string;
  snippet: string;
  score?: number;
}

export async function getPaperAIContext(
  paperId: number,
  sectionNumber: number,
  options?: {
    query?: string;
    recentCount?: number;
    ragLimit?: number;
    noteRagLimit?: number;
    noteCategories?: db.PaperNoteCategoryValue[];
    phase?: "outline" | "expand";
    userApiKey?: string;
    userBaseUrl?: string;
    userModel?: string;
    provider?: PaperKnowledgeProvider;
  }
): Promise<{
  ragContext: string;
  noteRagContext: string;
  structuredNotesContext: string;
  recentSections: Array<{
    number: number;
    title: string;
    content: string;
    summary?: string;
  }>;
  hasEmbeddings: boolean;
  sources?: PaperContextSource[];
  providerUsed?: "vertex" | "pgvector";
  fallbackReason?: string;
}> {
  const {
    query,
    recentCount = 2,
    ragLimit = 5,
    noteRagLimit = 6,
    noteCategories,
    phase = "outline",
    userApiKey,
    userBaseUrl,
    userModel,
    provider = ((process.env.KNOWLEDGE_PROVIDER || "hybrid") as PaperKnowledgeProvider),
  } = options || {};

  const allRecentSections = await db.getRecentPaperSections(paperId, recentCount + 1);
  const recentSections = allRecentSections
    .filter((section) => section.sectionNumber < sectionNumber)
    .slice(0, recentCount)
    .map((section) => ({
      number: section.sectionNumber,
      title: section.title,
      content: section.content,
      summary:
        section.content.length > 500
          ? `${section.content.slice(0, 500)}...`
          : section.content,
    }));

  const selectedCategories =
    noteCategories ||
    (phase === "expand" ? PAPER_EXPAND_NOTE_PRIORITY : PAPER_OUTLINE_NOTE_PRIORITY);

  const structuredNotesContext = await buildStructuredPaperNotesContext(
    paperId,
    selectedCategories,
    3
  );

  const sectionEmbeddingCount = await db.getPaperSectionEmbeddingCount(paperId);
  const noteEmbeddingCount = await db.getPaperNoteEmbeddingCount(paperId);
  const hasEmbeddings = sectionEmbeddingCount + noteEmbeddingCount > 0;

  let ragContext = "";
  let noteRagContext = "";
  const sources: PaperContextSource[] = [];
  let providerUsed: "vertex" | "pgvector" = "pgvector";
  let fallbackReason: string | undefined;

  const runPgVectorSearch = async () => {
    if (query && sectionEmbeddingCount > 0) {
      try {
        const results = await searchPaperSectionContext(
          paperId,
          query,
          ragLimit,
          userApiKey,
          userBaseUrl,
          userModel
        );

        const filtered = results.filter((r) => r.similarity > 0.45);
        ragContext = filtered
          .map((r) => truncateContext(r.content, 350))
          .join("\n\n---\n\n");
        sources.push(
          ...filtered.map((r) => ({
            provider: "pgvector" as const,
            snippet: truncateContext(r.content, 350),
            score: r.similarity,
          }))
        );
      } catch (error) {
        console.error("Paper section RAG search failed:", error);
      }
    }

    if (query && noteEmbeddingCount > 0) {
      try {
        const results = await searchPaperNoteContext(
          paperId,
          query,
          noteRagLimit,
          userApiKey,
          userBaseUrl,
          userModel
        );

        noteRagContext = results
          .filter((r) => r.similarity > 0.45)
          .map(
            (r) =>
              `[${PAPER_NOTE_CATEGORY_LABELS[r.category]}] ${truncateContext(
                r.content,
                240
              )}`
          )
          .join("\n");
      } catch (error) {
        console.error("Paper note RAG search failed:", error);
      }
    }
  };

  const runVertexSearch = async (): Promise<boolean> => {
    if (!query || !isVertexRagConfigured()) {
      return false;
    }

    const corpusName = await ensurePaperCorpus(paperId);
    if (!corpusName) {
      return false;
    }

    const vertex = await retrieveContexts({
      paperId,
      corpusName,
      query,
      topK: ragLimit,
    });

    ragContext = vertex.ragContext;
    const normalized = (vertex.sources || []).map<PaperContextSource>(
      (source: VertexContextSource) => ({
        provider: "vertex",
        title: source.title,
        uri: source.uri,
        snippet: source.snippet,
        score: source.score,
      })
    );
    sources.push(...normalized);
    return Boolean(ragContext || normalized.length > 0);
  };

  if (provider === "pgvector") {
    providerUsed = "pgvector";
    await runPgVectorSearch();
  } else if (provider === "vertex") {
    try {
      const hasVertexResult = await runVertexSearch();
      if (hasVertexResult) {
        providerUsed = "vertex";
      } else {
        providerUsed = "pgvector";
        fallbackReason = "vertex_empty_or_unconfigured";
        await runPgVectorSearch();
      }
    } catch (error) {
      providerUsed = "pgvector";
      fallbackReason = `vertex_error:${error instanceof Error ? error.message : String(error)}`;
      await runPgVectorSearch();
    }
  } else {
    try {
      const hasVertexResult = await runVertexSearch();
      if (hasVertexResult) {
        providerUsed = "vertex";
      } else {
        providerUsed = "pgvector";
        fallbackReason = "vertex_empty_or_unconfigured";
        await runPgVectorSearch();
      }
    } catch (error) {
      providerUsed = "pgvector";
      fallbackReason = `vertex_error:${error instanceof Error ? error.message : String(error)}`;
      await runPgVectorSearch();
    }
  }

  return {
    ragContext,
    noteRagContext,
    structuredNotesContext,
    recentSections,
    hasEmbeddings,
    sources,
    providerUsed,
    fallbackReason,
  };
}

// ============ Prompt Assembly ============

export async function buildContextPrompt(
  novelId: number,
  chapterNumber: number,
  options?: {
    query?: string;
    includeNotes?: boolean;
    userApiKey?: string;
    userBaseUrl?: string;
    userModel?: string;
  }
): Promise<string> {
  const { query, includeNotes = true, userApiKey, userBaseUrl, userModel } =
    options || {};

  const context = await getAIContext(novelId, chapterNumber, {
    query,
    phase: "outline",
    userApiKey,
    userBaseUrl,
    userModel,
  });

  const parts: string[] = [];

  if (context.recentChapters.length > 0) {
    parts.push("【前文回顾】");
    for (const ch of context.recentChapters.reverse()) {
      parts.push(`第 ${ch.number} 章 ${ch.title}：`);
      parts.push(ch.summary || ch.content);
      parts.push("");
    }
  }

  if (context.ragContext) {
    parts.push("【相关背景（正文检索）】");
    parts.push(context.ragContext);
    parts.push("");
  }

  if (includeNotes) {
    if (context.structuredNotesContext) {
      parts.push("【灵感笔记（分类）】");
      parts.push(context.structuredNotesContext);
      parts.push("");
    }

    if (context.noteRagContext) {
      parts.push("【灵感笔记（语义检索）】");
      parts.push(context.noteRagContext);
      parts.push("");
    }
  }

  return parts.join("\n");
}

export async function getNovelEmbeddingStats(novelId: number): Promise<{
  totalChunks: number;
  noteChunks: number;
  isConfigured: boolean;
}> {
  const totalChunks = await db.getEmbeddingCount(novelId);
  const noteChunks = await db.getNovelNoteEmbeddingCount(novelId);
  return {
    totalChunks,
    noteChunks,
    isConfigured: isEmbeddingConfigured(),
  };
}
