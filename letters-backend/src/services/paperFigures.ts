import type * as db from "../db/queries.js";
import { builtInVisionChatCompletion, chatJson, parseJsonObject } from "./chat.js";
import { googleCustomSearch, isWebSearchConfigured } from "./webSearch.js";
import { getPaperAIContext } from "./rag.js";

export const PAPER_DATA_TYPE_LABEL_ZH: Record<db.PaperDataTypeValue, string> = {
  line_chart: "折线图",
  bar_chart: "柱状图",
  stacked_bar_chart: "堆叠柱状图",
  scatter_plot: "散点图",
  histogram: "直方图",
  box_plot: "箱线图",
  heatmap: "热力图",
  pie_chart: "饼图",
  table: "表格",
  map: "地图",
  other: "其他数据图",
};

export interface FigureUploadRef {
  key: string;
  url: string;
  contentType: string;
  filename: string;
}

export interface FigureClassification {
  dataType: db.PaperDataTypeValue;
  detailDescriptionZh: string;
  mainFeatures: string[];
  suggestedQueries: string[];
  confidence: number;
}

export interface FigureAnalysisResult {
  captionZh: string;
  captionEn: string;
  analysisZh: string;
  analysisEn: string;
  keyTakeawaysZh?: string[];
  keyTakeawaysEn?: string[];
  webSearchEnabled: boolean;
}

function normalizeDataType(raw: unknown): db.PaperDataTypeValue {
  const value = typeof raw === "string" ? raw.trim() : "";
  const allowed = new Set<db.PaperDataTypeValue>([
    "line_chart",
    "bar_chart",
    "stacked_bar_chart",
    "scatter_plot",
    "histogram",
    "box_plot",
    "heatmap",
    "pie_chart",
    "table",
    "map",
    "other",
  ]);
  return allowed.has(value as db.PaperDataTypeValue)
    ? (value as db.PaperDataTypeValue)
    : "other";
}

export async function classifyPaperFigure(
  figureUrl: string
): Promise<FigureClassification> {
  const systemPrompt = `You are a senior data visualization analyst.
Given a single figure image, classify the chart/data type and extract key properties.

Allowed dataType values:
line_chart, bar_chart, stacked_bar_chart, scatter_plot, histogram, box_plot, heatmap, pie_chart, table, map, other

Return ONLY valid JSON with keys:
- dataType: one of the allowed values
- detailDescriptionZh: string (what the figure shows; include axes/legend text if visible)
- mainFeatures: string[] (trends, peaks, outliers, group differences, correlations; each item should be specific)
- suggestedQueries: string[] (1-3 web search queries using extracted labels/units/entities)
- confidence: number (0-1)

No extra keys. No markdown.`;

  const raw = await builtInVisionChatCompletion({
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this figure image and output JSON only." },
          { type: "image_url", image_url: { url: figureUrl } },
        ],
      },
    ],
    temperature: 0.1,
    maxTokens: 1200,
  });

  const parsed = parseJsonObject<{
    dataType?: unknown;
    detailDescriptionZh?: unknown;
    mainFeatures?: unknown;
    suggestedQueries?: unknown;
    confidence?: unknown;
  }>(raw);

  const mainFeatures = Array.isArray(parsed.mainFeatures)
    ? parsed.mainFeatures
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const suggestedQueries = Array.isArray(parsed.suggestedQueries)
    ? parsed.suggestedQueries
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .slice(0, 3)
    : [];

  const confidence =
    typeof parsed.confidence === "number"
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.5;

  return {
    dataType: normalizeDataType(parsed.dataType),
    detailDescriptionZh:
      typeof parsed.detailDescriptionZh === "string"
        ? parsed.detailDescriptionZh.trim()
        : "",
    mainFeatures,
    suggestedQueries,
    confidence,
  };
}

export async function analyzePaperFigure(options: {
  paperId: number;
  classification: FigureClassification;
  userSettings: {
    apiKey?: string | null;
    apiBaseUrl?: string | null;
    modelName?: string | null;
    embeddingApiKey?: string | null;
    embeddingBaseUrl?: string | null;
    embeddingModel?: string | null;
  } | null;
}): Promise<FigureAnalysisResult> {
  const { classification } = options;
  const queryForRag = [
    `数据类型:${classification.dataType}`,
    classification.detailDescriptionZh,
    classification.mainFeatures.join("；"),
  ]
    .filter(Boolean)
    .join(" ");

  const rag = await getPaperAIContext(options.paperId, 99999, {
    query: queryForRag.slice(0, 500),
    phase: "expand",
    recentCount: 2,
    ragLimit: 5,
    noteRagLimit: 6,
    userApiKey: options.userSettings?.embeddingApiKey || undefined,
    userBaseUrl: options.userSettings?.embeddingBaseUrl || undefined,
    userModel: options.userSettings?.embeddingModel || undefined,
  });

  const webSearchEnabled = isWebSearchConfigured();
  const queries = classification.suggestedQueries.slice(0, 2);
  const webResults: Array<{
    query: string;
    results: Array<{ title: string; snippet: string; url: string }>;
  }> = [];

  if (webSearchEnabled) {
    const tasks = queries
      .filter(Boolean)
      .map(async (q) => {
        try {
          const results = await googleCustomSearch(q, { num: 3 });
          return {
            query: q,
            results: results.map((r) => ({
              title: r.title,
              snippet: r.snippet,
              url: r.url,
            })),
          };
        } catch (error) {
          console.error("Google web search failed", { query: q, error });
          return null;
        }
      });

    const settled = await Promise.all(tasks);
    for (const item of settled) {
      if (item) webResults.push(item);
    }
  }

  const systemPrompt = `You are an academic writing and data analysis assistant.
You will be given:
1) A figure classification (dataType + features)
2) Optional web search snippets (may be empty)
3) Optional in-project knowledge base context (may be empty)

Task:
- Produce a bilingual (Chinese + English) analysis in a fixed structure suitable for an academic paper.
- Provide concise captions (Chinese + English).
- If evidence is insufficient, clearly state assumptions and mark [需补引文] / [Citation Needed].

Output ONLY valid JSON with keys:
- captionZh: string
- captionEn: string
- analysisZh: string
- analysisEn: string
- keyTakeawaysZh: string[]
- keyTakeawaysEn: string[]

No markdown. No extra keys.`;

  const userPrompt = [
    `【Figure Classification】`,
    JSON.stringify(
      {
        dataType: classification.dataType,
        detailDescriptionZh: classification.detailDescriptionZh,
        mainFeatures: classification.mainFeatures,
        suggestedQueries: classification.suggestedQueries,
        confidence: classification.confidence,
      },
      null,
      2
    ),
    ``,
    `【Web Search】`,
    webSearchEnabled ? JSON.stringify(webResults, null, 2) : "WEB_SEARCH_DISABLED",
    ``,
    `【Knowledge Base - Paper Context (RAG)】`,
    rag.ragContext || "",
    ``,
    `【Knowledge Base - Notes (Structured)】`,
    rag.structuredNotesContext || "",
    ``,
    `【Knowledge Base - Notes (Semantic)】`,
    rag.noteRagContext || "",
    ``,
    `Please follow this structure inside analysisZh and analysisEn (use the same headings):`,
    `1) Data overview / 图表概述`,
    `2) Key findings / 关键发现 (bullet-like lines)`,
    `3) Interpretation / 可能解释与机制`,
    `4) Methodology & checks / 方法与检验建议`,
    `5) Limitations / 局限与偏差`,
    `6) Paper-ready paragraph / 可直接写入论文段落`,
  ].join("\n");

  const parsed = await chatJson<{
    captionZh: string;
    captionEn: string;
    analysisZh: string;
    analysisEn: string;
    keyTakeawaysZh?: string[];
    keyTakeawaysEn?: string[];
  }>({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    userApiKey: options.userSettings?.apiKey || undefined,
    userBaseUrl: options.userSettings?.apiBaseUrl || undefined,
    userModel: options.userSettings?.modelName || undefined,
    temperature: 0.2,
    maxTokens: 3000,
    repairOnce: true,
  });

  return {
    captionZh: String(parsed.captionZh || "").trim(),
    captionEn: String(parsed.captionEn || "").trim(),
    analysisZh: String(parsed.analysisZh || "").trim(),
    analysisEn: String(parsed.analysisEn || "").trim(),
    keyTakeawaysZh: Array.isArray(parsed.keyTakeawaysZh)
      ? parsed.keyTakeawaysZh.map(String).filter(Boolean).slice(0, 12)
      : [],
    keyTakeawaysEn: Array.isArray(parsed.keyTakeawaysEn)
      ? parsed.keyTakeawaysEn.map(String).filter(Boolean).slice(0, 12)
      : [],
    webSearchEnabled,
  };
}
