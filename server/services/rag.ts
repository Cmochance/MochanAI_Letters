import { invokeLLM } from "../_core/llm";
import * as db from "../db";
import { InsertChapterEmbedding, ChapterEmbedding } from "../../drizzle/schema";

/**
 * Split text into chunks for embedding
 */
export function splitTextIntoChunks(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.substring(start, end);
    chunks.push(chunk);
    
    // Move start position with overlap
    start += chunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Generate embedding for a single text using built-in LLM
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // Note: The built-in LLM doesn't support embedding API directly
  // We use a simple hash-based embedding for development
  // In production, users will configure their own OpenAI API key for embeddings
  return generateSimpleEmbedding(text);
}

/**
 * Generate a simple hash-based embedding (fallback for development)
 * In production, this should be replaced with proper embedding API
 */
function generateSimpleEmbedding(text: string, dimensions: number = 1536): number[] {
  const embedding = new Array(dimensions).fill(0);
  
  // Simple hash-based approach
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (charCode * i) % dimensions;
    embedding[index] += charCode / 1000;
  }
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
  // For now, generate embeddings one by one
  // In production, use batch API for better performance
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

/**
 * Vectorize a chapter and save embeddings to database
 */
export async function vectorizeChapter(chapterId: number): Promise<void> {
  const chapter = await db.getChapterById(chapterId);
  if (!chapter) {
    throw new Error("Chapter not found");
  }
  
  // Delete existing embeddings for this chapter
  await db.deleteChapterEmbeddings(chapterId);
  
  // Split content into chunks
  const chunks = splitTextIntoChunks(chapter.content);
  
  // Generate embeddings for all chunks
  const embeddings = await batchGenerateEmbeddings(chunks);
  
  // Prepare embedding records
  const embeddingRecords: InsertChapterEmbedding[] = chunks.map((chunk, index) => ({
    chapterId: chapter.id,
    novelId: chapter.novelId,
    contentChunk: chunk,
    embedding: JSON.stringify(embeddings[index]),
  }));
  
  // Save to database
  await db.saveChapterEmbeddings(embeddingRecords);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Search for relevant context chunks using vector similarity
 */
export async function searchRAGContext(
  novelId: number,
  query: string,
  limit: number = 10
): Promise<Array<{ content: string; similarity: number }>> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  
  // Get all embeddings for this novel
  const allEmbeddings = await db.getNovelEmbeddings(novelId);
  
  if (allEmbeddings.length === 0) {
    return [];
  }
  
  // Calculate similarities
  const results = allEmbeddings.map((embedding) => {
    const embeddingVector = JSON.parse(embedding.embedding) as number[];
    const similarity = cosineSimilarity(queryEmbedding, embeddingVector);
    
    return {
      content: embedding.contentChunk,
      similarity,
    };
  });
  
  // Sort by similarity (descending) and return top results
  results.sort((a, b) => b.similarity - a.similarity);
  
  return results.slice(0, limit);
}

/**
 * Get context for AI generation
 * Combines RAG search results with recent chapters
 */
export async function getAIContext(
  novelId: number,
  currentChapterNumber: number,
  recentChaptersLimit: number = 3
): Promise<{
  ragContext: string;
  recentChapters: Array<{ number: number; title: string; content: string }>;
}> {
  // Get recent chapters
  const recentChapters = await db.getRecentChapters(novelId, recentChaptersLimit);
  
  // Build query from recent chapters
  const query = recentChapters.map((ch) => ch.content).join("\n\n");
  
  // Search RAG for relevant context
  const ragResults = await searchRAGContext(novelId, query, 15);
  
  // Build context string
  const ragContext = ragResults
    .map((result, index) => `[相关片段 ${index + 1}]\n${result.content}`)
    .join("\n\n");
  
  return {
    ragContext,
    recentChapters: recentChapters.map((ch) => ({
      number: ch.chapterNumber,
      title: ch.title,
      content: ch.content,
    })),
  };
}
