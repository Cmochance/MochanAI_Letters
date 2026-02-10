export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  displayLink?: string;
}

export function isWebSearchConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX);
}

export async function googleCustomSearch(
  query: string,
  options?: {
    num?: number;
  }
): Promise<WebSearchResult[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;

  if (!apiKey || !cx) {
    return [];
  }

  const num = Math.max(1, Math.min(options?.num ?? 3, 10));
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(num));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Google CSE request failed: ${response.status} ${response.statusText} ${text}`
    );
  }

  const data = (await response.json()) as {
    items?: Array<{
      title?: string;
      snippet?: string;
      link?: string;
      displayLink?: string;
    }>;
  };

  return (data.items || [])
    .map((item) => ({
      title: item.title || "",
      snippet: item.snippet || "",
      url: item.link || "",
      displayLink: item.displayLink,
    }))
    .filter((item) => item.url);
}

