import { randomUUID } from "node:crypto";
import { Storage } from "@google-cloud/storage";
import * as db from "../db/queries.js";
import { getGoogleAccessToken, getGoogleProjectId, isGcpConfigured } from "./gcpAuth.js";

export interface VertexContextSource {
  provider: "vertex";
  title?: string;
  uri?: string;
  snippet: string;
  score?: number;
}

export interface VertexRetrieveResult {
  ragContext: string;
  sources: VertexContextSource[];
}

const DEFAULT_LOCATION = "us-central1";
const DEFAULT_EMBEDDING_MODEL = "publishers/google/models/text-embedding-005";

let storageClient: Storage | null = null;

function getStorageClient() {
  if (!storageClient) {
    storageClient = new Storage();
  }
  return storageClient;
}

function getLocation(): string {
  return process.env.GCP_LOCATION?.trim() || DEFAULT_LOCATION;
}

function getVertexBaseUrl() {
  const location = getLocation();
  return `https://${location}-aiplatform.googleapis.com/v1`;
}

function getSourceBucket(): string {
  return process.env.VERTEX_RAG_SOURCE_BUCKET?.trim() || "";
}

function getEmbeddingModel(): string {
  return process.env.VERTEX_RAG_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function isVertexRagConfigured(): boolean {
  return isGcpConfigured() && Boolean(getSourceBucket());
}

async function vertexFetch(path: string, init: RequestInit = {}) {
  const token = await getGoogleAccessToken();
  const response = await fetch(`${getVertexBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Vertex request failed: ${response.status} ${response.statusText} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractOperationName(payload: unknown): string {
  const record = asRecord(payload);
  const name = record.name;
  if (typeof name !== "string" || !name) {
    throw new Error("Vertex operation name missing");
  }
  return name;
}

function extractRagFileName(operationPayload: unknown): string | null {
  const op = asRecord(operationPayload);
  const response = asRecord(op.response);
  const direct = asRecord(response.ragFile);
  if (typeof direct.name === "string" && direct.name) return direct.name;

  const imported = response.importedRagFiles;
  if (Array.isArray(imported) && imported.length > 0) {
    const first = asRecord(imported[0]);
    if (typeof first.name === "string" && first.name) return first.name;
  }

  const metadata = asRecord(op.metadata);
  const metadataFiles = metadata.ragFiles;
  if (Array.isArray(metadataFiles) && metadataFiles.length > 0) {
    const first = asRecord(metadataFiles[0]);
    if (typeof first.name === "string" && first.name) return first.name;
  }

  return null;
}

function normalizeSnippet(text: string, max = 800): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized;
}

function parseRetrieveSources(payload: unknown): VertexContextSource[] {
  const data = asRecord(payload);
  const contextsWrapper = asRecord(data.contexts);
  const contexts = Array.isArray(contextsWrapper.contexts)
    ? contextsWrapper.contexts
    : Array.isArray(data.contexts)
      ? (data.contexts as unknown[])
      : [];

  const sources: VertexContextSource[] = [];

  for (const item of contexts) {
    const row = asRecord(item);
    const text =
      (typeof row.text === "string" && row.text) ||
      (typeof row.snippet === "string" && row.snippet) ||
      "";
    if (!text) continue;

    const sourceUri =
      (typeof row.sourceUri === "string" && row.sourceUri) ||
      (typeof row.uri === "string" && row.uri) ||
      (typeof row.source === "string" && row.source) ||
      undefined;

    const title =
      (typeof row.title === "string" && row.title) ||
      (typeof row.displayName === "string" && row.displayName) ||
      undefined;

    const score = typeof row.score === "number" ? row.score : undefined;

    sources.push({
      provider: "vertex",
      title,
      uri: sourceUri,
      score,
      snippet: normalizeSnippet(text),
    });
  }

  return sources;
}

export async function pollLongRunningOperation(
  operationName: string,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<unknown> {
  const timeoutMs = options?.timeoutMs ?? 120_000;
  const intervalMs = options?.intervalMs ?? 2_000;
  const startedAt = Date.now();

  while (true) {
    const payload = await vertexFetch(`/${operationName}`, { method: "GET" });
    const op = asRecord(payload);
    if (op.done === true) {
      const error = asRecord(op.error);
      if (Object.keys(error).length > 0) {
        throw new Error(`Vertex operation failed: ${JSON.stringify(error)}`);
      }
      return payload;
    }

    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Vertex operation timeout: ${operationName}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function ensurePaperCorpus(paperId: number): Promise<string | null> {
  if (!isVertexRagConfigured()) return null;

  const paper = await db.getPaperById(paperId);
  if (!paper) throw new Error("Paper not found");

  if (paper.vertexRagCorpusName) {
    return paper.vertexRagCorpusName;
  }

  const projectId = await getGoogleProjectId();
  const location = getLocation();
  const parent = `/projects/${projectId}/locations/${location}`;
  const payload = await vertexFetch(`${parent}/ragCorpora`, {
    method: "POST",
    body: JSON.stringify({
      displayName: `paper-${paperId}`,
      description: `Paper ${paperId} corpus`,
    }),
  });

  const record = asRecord(payload);
  const name = typeof record.name === "string" ? record.name : "";
  if (!name) {
    throw new Error("Vertex rag corpus creation returned empty name");
  }

  await db.updatePaper(paperId, {
    vertexRagCorpusName: name,
    vertexRagReadyAt: new Date(),
  });

  return name;
}

export async function uploadPaperKnowledgeMarkdown(options: {
  paperId: number;
  itemId: number;
  lang: "zh" | "en";
  filenamePrefix: string;
  content: string;
}): Promise<string> {
  if (!isVertexRagConfigured()) {
    throw new Error("Vertex RAG source bucket is not configured");
  }

  const bucketName = getSourceBucket();
  const bucket = getStorageClient().bucket(bucketName);

  const key = [
    `papers/${options.paperId}`,
    `kb/${options.itemId}`,
    `${options.filenamePrefix}-${options.lang}-${Date.now()}-${randomUUID()}.md`,
  ].join("/");

  await bucket.file(key).save(options.content, {
    contentType: "text/markdown; charset=utf-8",
    resumable: false,
    metadata: {
      cacheControl: "private, max-age=0, no-cache",
    },
  });

  return `gs://${bucketName}/${key}`;
}

export async function deleteRagFile(ragFileName: string): Promise<void> {
  if (!isVertexRagConfigured() || !ragFileName) return;

  await vertexFetch(`/${ragFileName}`, { method: "DELETE" }).catch((error) => {
    console.error("Failed to delete Vertex rag file", { ragFileName, error });
    throw error;
  });
}

export async function importRagFiles(options: {
  paperId: number;
  corpusName: string;
  gcsUri: string;
}): Promise<{ ragFileName: string | null }> {
  if (!isVertexRagConfigured()) {
    return { ragFileName: null };
  }

  const response = await vertexFetch(`/${options.corpusName}/ragFiles:import`, {
    method: "POST",
    body: JSON.stringify({
      importRagFilesConfig: {
        gcsSource: {
          uris: [options.gcsUri],
        },
        ragFileTransformationConfig: {
          chunkingConfig: {
            fixedLengthChunking: {
              chunkSize: 1024,
              chunkOverlap: 128,
            },
          },
        },
      },
    }),
  });

  const operationName = extractOperationName(response);
  const operationResult = await pollLongRunningOperation(operationName, {
    timeoutMs: 180_000,
    intervalMs: 2_500,
  });

  return {
    ragFileName: extractRagFileName(operationResult),
  };
}

export async function retrieveContexts(options: {
  paperId: number;
  corpusName: string;
  query: string;
  topK?: number;
}): Promise<VertexRetrieveResult> {
  if (!isVertexRagConfigured()) {
    return { ragContext: "", sources: [] };
  }

  const projectId = await getGoogleProjectId();
  const location = getLocation();
  const payload = await vertexFetch(`/projects/${projectId}/locations/${location}:retrieveContexts`, {
    method: "POST",
    body: JSON.stringify({
      query: {
        text: options.query,
      },
      vertexRagStore: {
        ragResources: [{ ragCorpus: options.corpusName }],
        similarityTopK: Math.max(1, Math.min(options.topK ?? 6, 20)),
        vectorDistanceThreshold: 0.45,
        ragEmbeddingModelConfig: {
          vertexPredictionEndpoint: {
            publisherModel: getEmbeddingModel(),
          },
        },
      },
    }),
  });

  const sources = parseRetrieveSources(payload);
  const ragContext = sources.map((s) => s.snippet).join("\n\n---\n\n");

  return { ragContext, sources };
}
