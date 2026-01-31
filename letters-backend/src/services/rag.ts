import * as db from "../db/queries.js";
import {
  generateEmbedding,
  batchGenerateEmbeddings,
  isEmbeddingConfigured,
} from "./embedding.js";

/**
 * RAG (Retrieval-Augmented Generation) Service
 * Provides context-aware content retrieval for AI-assisted writing
 */

// Configuration
const DEFAULT_CHUNK_SIZE = 800; // Characters per chunk
const DEFAULT_CHUNK_OVERLAP = 100; // Overlap between chunks
const MIN_CONTENT_LENGTH = 100; // Minimum content length to vectorize

/**
 * Split text into overlapping chunks for embedding
 * Uses character-based splitting with overlap for context continuity
 */
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
    // Find a good break point (end of sentence or paragraph)
    let end = Math.min(start + chunkSize, text.length);

    // If not at the end, try to break at sentence boundary
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

    // Move start position with overlap
    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Vectorize a chapter's content and store embeddings
 * @param chapterId - The chapter to vectorize
 * @param userApiKey - Optional user-provided API key
 * @param userBaseUrl - Optional user-provided base URL
 * @param userModel - Optional user-provided model name
 */
export async function vectorizeChapter(
  chapterId: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<{ chunksCreated: number }> {
  // Check if embedding is configured
  if (!isEmbeddingConfigured() && !userApiKey) {
    console.warn("Embedding API not configured, skipping vectorization");
    return { chunksCreated: 0 };
  }

  const chapter = await db.getChapterById(chapterId);
  if (!chapter) {
    throw new Error(`Chapter ${chapterId} not found`);
  }

  // Skip if content is too short
  if (chapter.content.length < MIN_CONTENT_LENGTH) {
    return { chunksCreated: 0 };
  }

  // Delete existing embeddings for this chapter
  await db.deleteChapterEmbeddings(chapterId);

  // Split content into chunks
  const chunks = splitTextIntoChunks(chapter.content);
  if (chunks.length === 0) {
    return { chunksCreated: 0 };
  }

  // Generate embeddings in batch
  const embeddings = await batchGenerateEmbeddings(
    chunks,
    userApiKey,
    userBaseUrl,
    userModel
  );

  // Store embeddings
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

/**
 * Vectorize all chapters of a novel
 * @param novelId - The novel to vectorize
 * @param userApiKey - Optional user-provided API key
 * @param userBaseUrl - Optional user-provided base URL
 * @param userModel - Optional user-provided model name
 */
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
        chaptersProcessed++;
      }
    } catch (error) {
      console.error(`Failed to vectorize chapter ${chapter.id}:`, error);
    }
  }

  return { totalChunks, chaptersProcessed };
}

/**
 * Search for relevant content using vector similarity
 * @param novelId - The novel to search within
 * @param query - The search query
 * @param limit - Maximum number of results
 * @param userApiKey - Optional user-provided API key
 * @param userBaseUrl - Optional user-provided base URL
 * @param userModel - Optional user-provided model name
 */
export async function searchRAGContext(
  novelId: number,
  query: string,
  limit: number = 5,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<Array<{ content: string; similarity: number; chapterId: number }>> {
  // Check if embedding is configured
  if (!isEmbeddingConfigured() && !userApiKey) {
    console.warn("Embedding API not configured, returning empty results");
    return [];
  }

  // Check if novel has embeddings
  const embeddingCount = await db.getEmbeddingCount(novelId);
  if (embeddingCount === 0) {
    return [];
  }

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(
    query,
    userApiKey,
    userBaseUrl,
    userModel
  );

  // Search for similar chunks
  const results = await db.searchSimilarChunks(novelId, queryEmbedding, limit);

  return results.map((r) => ({
    content: r.content_chunk,
    similarity: r.similarity,
    chapterId: r.chapter_id,
  }));
}

/**
 * Get AI context combining RAG results and recent chapters
 * This is the main function used by the AI service for context-aware generation
 */
export async function getAIContext(
  novelId: number,
  chapterNumber: number,
  options?: {
    query?: string;
    recentCount?: number;
    ragLimit?: number;
    userApiKey?: string;
    userBaseUrl?: string;
    userModel?: string;
  }
): Promise<{
  ragContext: string;
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
    userApiKey,
    userBaseUrl,
    userModel,
  } = options || {};

  // Get recent chapters (before the current chapter)
  const allRecentChapters = await db.getRecentChapters(novelId, recentCount + 1);
  const recentChapters = allRecentChapters
    .filter((ch) => ch.chapterNumber < chapterNumber)
    .slice(0, recentCount)
    .map((ch) => ({
      number: ch.chapterNumber,
      title: ch.title,
      content: ch.content,
      // Generate a brief summary for context (first 500 chars)
      summary: ch.content.length > 500 
        ? ch.content.slice(0, 500) + "..." 
        : ch.content,
    }));

  // Check if novel has embeddings
  const embeddingCount = await db.getEmbeddingCount(novelId);
  const hasEmbeddings = embeddingCount > 0;

  // Get RAG context if query is provided and embeddings exist
  let ragContext = "";
  if (query && hasEmbeddings) {
    try {
      const ragResults = await searchRAGContext(
        novelId,
        query,
        ragLimit,
        userApiKey,
        userBaseUrl,
        userModel
      );

      if (ragResults.length > 0) {
        ragContext = ragResults
          .filter((r) => r.similarity > 0.5) // Only include relevant results
          .map((r) => r.content)
          .join("\n\n---\n\n");
      }
    } catch (error) {
      console.error("RAG search failed:", error);
    }
  }

  return {
    ragContext,
    recentChapters,
    hasEmbeddings,
  };
}

/**
 * Build a comprehensive context prompt for AI generation
 * Combines RAG context, recent chapters, and user notes
 */
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
    userApiKey,
    userBaseUrl,
    userModel,
  });

  const parts: string[] = [];

  // Add recent chapters summary
  if (context.recentChapters.length > 0) {
    parts.push("【前文回顾】");
    for (const ch of context.recentChapters.reverse()) {
      parts.push(`第 ${ch.number} 章 ${ch.title}：`);
      parts.push(ch.summary || ch.content);
      parts.push("");
    }
  }

  // Add RAG context if available
  if (context.ragContext) {
    parts.push("【相关背景】");
    parts.push(context.ragContext);
    parts.push("");
  }

  // Add notes if requested
  if (includeNotes) {
    const novel = await db.getNovelById(novelId);
    if (novel) {
      const novelNotes = await db.getNovelNotes(novelId);
      if (novelNotes.length > 0) {
        parts.push("【创作笔记】");
        for (const note of novelNotes.slice(0, 5)) {
          parts.push(`- ${note.title}: ${note.content.slice(0, 200)}`);
        }
        parts.push("");
      }
    }
  }

  return parts.join("\n");
}

/**
 * Get embedding statistics for a novel
 */
export async function getNovelEmbeddingStats(novelId: number): Promise<{
  totalChunks: number;
  isConfigured: boolean;
}> {
  const totalChunks = await db.getEmbeddingCount(novelId);
  return {
    totalChunks,
    isConfigured: isEmbeddingConfigured(),
  };
}
