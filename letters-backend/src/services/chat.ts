export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: unknown;
}

function normalizeOpenAICompatibleBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function getBuiltInChatConfig(): {
  apiKey: string;
  baseUrl: string;
  model: string;
  visionModel: string;
} {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  if (!apiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }
  const rawBaseUrl = process.env.BUILT_IN_FORGE_BASE_URL || "https://api.openai.com/v1";
  const baseUrl = normalizeOpenAICompatibleBaseUrl(rawBaseUrl);
  const model = process.env.BUILT_IN_FORGE_MODEL || "gpt-4";
  const visionModel = process.env.BUILT_IN_FORGE_VISION_MODEL || model;

  return { apiKey, baseUrl, model, visionModel };
}

function buildChatRequestBody(options: {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Record<string, unknown> {
  return {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 4096,
  };
}

async function fetchChatCompletion(options: {
  apiKey: string;
  baseUrl: string;
  body: Record<string, unknown>;
}): Promise<any> {
  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(options.body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Chat completion failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export async function builtInChatCompletion(options: {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const cfg = getBuiltInChatConfig();
  const body = buildChatRequestBody({
    model: options.model || cfg.model,
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  const data = await fetchChatCompletion({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    body,
  });
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function builtInVisionChatCompletion(options: {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const cfg = getBuiltInChatConfig();
  const body = buildChatRequestBody({
    model: cfg.visionModel,
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });
  const data = await fetchChatCompletion({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    body,
  });
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function userChatCompletion(options: {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const baseUrl = normalizeOpenAICompatibleBaseUrl(options.baseUrl);
  const body = buildChatRequestBody({
    model: options.model,
    messages: options.messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  const data = await fetchChatCompletion({
    apiKey: options.apiKey,
    baseUrl,
    body,
  });
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

function stripCodeFences(text: string): string {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return text.trim();
}

function extractJsonObjectCandidate(text: string): string | null {
  const cleaned = stripCodeFences(text);
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) return cleaned;

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return cleaned.slice(first, last + 1);
}

export function parseJsonObject<T = any>(raw: string): T {
  const candidate = extractJsonObjectCandidate(raw);
  if (!candidate) {
    throw new Error("No JSON object found in model output");
  }
  return JSON.parse(candidate) as T;
}

export async function chatJson<T = any>(options: {
  messages: ChatMessage[];
  userApiKey?: string;
  userBaseUrl?: string;
  userModel?: string;
  temperature?: number;
  maxTokens?: number;
  builtInModelOverride?: string;
  repairOnce?: boolean;
}): Promise<T> {
  const useUser = Boolean(options.userApiKey && options.userBaseUrl);

  const raw = useUser
    ? await userChatCompletion({
        apiKey: options.userApiKey!,
        baseUrl: options.userBaseUrl!,
        model: options.userModel || "gpt-4",
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })
    : await builtInChatCompletion({
        model: options.builtInModelOverride,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });

  try {
    return parseJsonObject<T>(raw);
  } catch (error) {
    if (!options.repairOnce) throw error;

    const repairMessages: ChatMessage[] = [
      {
        role: "system",
        content:
          "You are a strict JSON formatter. Return ONLY a valid JSON object that matches the required schema, with no markdown and no extra text.",
      },
      {
        role: "user",
        content: raw,
      },
    ];

    const repaired = useUser
      ? await userChatCompletion({
          apiKey: options.userApiKey!,
          baseUrl: options.userBaseUrl!,
          model: options.userModel || "gpt-4",
          messages: repairMessages,
          temperature: 0,
          maxTokens: options.maxTokens,
        })
      : await builtInChatCompletion({
          model: options.builtInModelOverride,
          messages: repairMessages,
          temperature: 0,
          maxTokens: options.maxTokens,
        });

    return parseJsonObject<T>(repaired);
  }
}

