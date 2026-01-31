import OpenAI from "openai";

/**
 * Embedding Service
 * Generates vector embeddings for text using OpenAI's text-embedding-3-small model
 * Supports both built-in API and user-provided API configurations
 */

// Default embedding model configuration
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// Maximum tokens per request (text-embedding-3-small supports up to 8191 tokens)
const MAX_TOKENS_PER_REQUEST = 8000;

// Lazy initialization of OpenAI client
let defaultClient: OpenAI | null = null;

function getDefaultClient(): OpenAI {
  if (!defaultClient) {
    const apiKey = process.env.EMBEDDING_API_KEY;
    const baseURL = process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1";

    if (!apiKey) {
      throw new Error(
        "Embedding API is not configured. Please set EMBEDDING_API_KEY environment variable."
      );
    }

    defaultClient = new OpenAI({
      apiKey,
      baseURL,
    });
  }
  return defaultClient;
}

/**
 * Create a custom OpenAI client with user-provided credentials
 */
function createUserClient(apiKey: string, baseUrl?: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: baseUrl || "https://api.openai.com/v1",
  });
}

/**
 * Check if embedding service is configured
 */
export function isEmbeddingConfigured(): boolean {
  return !!process.env.EMBEDDING_API_KEY;
}

/**
 * Get the embedding model name
 */
export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

/**
 * Get the embedding dimensions
 */
export function getEmbeddingDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Generate embedding for a single text
 * @param text - The text to embed
 * @param userApiKey - Optional user-provided API key
 * @param userBaseUrl - Optional user-provided base URL
 * @param userModel - Optional user-provided model name
 * @returns Array of floats representing the embedding vector
 */
export async function generateEmbedding(
  text: string,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<number[]> {
  const client = userApiKey
    ? createUserClient(userApiKey, userBaseUrl)
    : getDefaultClient();

  const model = userModel || getEmbeddingModel();

  // Truncate text if too long (rough estimate: 1 token ≈ 4 characters for English, 2 for Chinese)
  const maxChars = MAX_TOKENS_PER_REQUEST * 2;
  const truncatedText = text.length > maxChars ? text.slice(0, maxChars) : text;

  const response = await client.embeddings.create({
    model,
    input: truncatedText,
    encoding_format: "float",
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to embed
 * @param userApiKey - Optional user-provided API key
 * @param userBaseUrl - Optional user-provided base URL
 * @param userModel - Optional user-provided model name
 * @returns Array of embedding vectors
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const client = userApiKey
    ? createUserClient(userApiKey, userBaseUrl)
    : getDefaultClient();

  const model = userModel || getEmbeddingModel();

  // Truncate each text if too long
  const maxChars = MAX_TOKENS_PER_REQUEST * 2;
  const truncatedTexts = texts.map((text) =>
    text.length > maxChars ? text.slice(0, maxChars) : text
  );

  // OpenAI API supports batch embedding, but has limits
  // Process in batches of 100 texts at a time
  const BATCH_SIZE = 100;
  const results: number[][] = [];

  for (let i = 0; i < truncatedTexts.length; i += BATCH_SIZE) {
    const batch = truncatedTexts.slice(i, i + BATCH_SIZE);

    const response = await client.embeddings.create({
      model,
      input: batch,
      encoding_format: "float",
    });

    // Sort by index to maintain order
    const sortedData = response.data.sort((a, b) => a.index - b.index);
    results.push(...sortedData.map((d) => d.embedding));
  }

  return results;
}

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Convert embedding array to PostgreSQL vector string format
 * @param embedding - Array of floats
 * @returns PostgreSQL vector string format: [0.1,0.2,0.3,...]
 */
export function embeddingToVectorString(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

/**
 * Parse PostgreSQL vector string to embedding array
 * @param vectorString - PostgreSQL vector string format
 * @returns Array of floats
 */
export function vectorStringToEmbedding(vectorString: string): number[] {
  // Handle both "[1,2,3]" and "1,2,3" formats
  const cleaned = vectorString.replace(/^\[|\]$/g, "");
  return cleaned.split(",").map((s) => parseFloat(s.trim()));
}
