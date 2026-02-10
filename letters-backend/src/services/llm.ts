interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface LLMOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

/**
 * Invoke built-in LLM service
 */
export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = process.env.BUILT_IN_FORGE_API_KEY;
  const baseUrl =
    process.env.BUILT_IN_FORGE_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.BUILT_IN_FORGE_MODEL || "gpt-4";

  if (!apiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  // Ensure baseUrl ends with /v1 for OpenAI compatibility
  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;

  const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`LLM API call failed: ${response.status} - ${errorText}`);
  }

  return (await response.json()) as LLMResponse;
}

/**
 * Call user's OpenAI-compatible API
 */
export async function callUserAPI(
  prompt: string,
  apiKey: string,
  baseUrl: string,
  model: string
): Promise<string> {
  // Ensure baseUrl ends with /v1 for OpenAI compatibility
  const normalizedBaseUrl = baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
  const url = `${normalizedBaseUrl}/chat/completions`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`API call failed: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as LLMResponse;
  const content = data?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}
