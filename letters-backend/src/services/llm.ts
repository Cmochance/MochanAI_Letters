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
    process.env.BUILT_IN_FORGE_BASE_URL || "https://api.openai.com";

  if (!apiKey) {
    throw new Error("BUILT_IN_FORGE_API_KEY is not configured");
  }

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM API call failed: ${response.statusText}`);
  }

  return response.json();
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
  const url = `${baseUrl}/v1/chat/completions`;

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
    throw new Error(`API call failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
