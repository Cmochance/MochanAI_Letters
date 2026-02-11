import * as db from "../db/queries.js";
import { chatJson } from "./chat.js";
import { getPaperAIContext } from "./rag.js";

export type PaperWritingPartType =
  | "body"
  | "introduction"
  | "conclusion"
  | "abstract"
  | "title";

export interface PaperWritingDraft {
  zh: string;
  en: string;
  keywordsZh?: string;
  keywordsEn?: string;
  providerUsed?: "vertex" | "pgvector";
  sources?: Array<{
    provider: "vertex" | "pgvector";
    title?: string;
    uri?: string;
    snippet: string;
    score?: number;
  }>;
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getDefaultStyle(style: string | null | undefined): string {
  return style?.trim() || "学术严谨、结构清晰、结论有证据支撑";
}

function partSystemPrompt(partType: PaperWritingPartType): string {
  const common = `You are an academic writing assistant.
Return ONLY valid JSON with keys:
- zh: string
- en: string
- keywordsZh?: string (comma-separated)
- keywordsEn?: string (comma-separated)
No markdown. No extra keys.`;

  if (partType === "title") {
    return `${common}
Task: Generate a Chinese paper title (15-30 Chinese characters) and an English title (8-16 words).
Avoid hype. Do NOT include any figure markers.`;
  }

  if (partType === "abstract") {
    return `${common}
Task: Generate bilingual abstract (ZH + EN) and keywords for each language (4-8 items).
Chinese abstract: about 150-250 characters. English abstract: about 120-180 words.
Do NOT include any figure markers.`;
  }

  if (partType === "introduction") {
    return `${common}
Task: Write bilingual Introduction (ZH + EN): background, research question, contributions, and a short roadmap.
Do NOT include any figure markers.`;
  }

  if (partType === "conclusion") {
    return `${common}
Task: Write bilingual Conclusion (ZH + EN): summarize findings, contributions, limitations, and future work.
Do NOT include any figure markers.`;
  }

  return `${common}
Task: Write bilingual main body (ZH + EN) with sections: Methods, Results, Discussion.
IMPORTANT:
- You MUST include figure markers as standalone lines in BOTH zh and en:
  [[FIGURE:<dataType>]]
- Each available figure dataType MUST appear at least once.
- Markers should appear in Results where relevant. If unsure, append them at the end of Results.
Do not include any other marker formats.`;
}

export async function generatePaperWritingPart(options: {
  paperId: number;
  partType: PaperWritingPartType;
  userId: number;
  userSettings: {
    apiKey?: string | null;
    apiBaseUrl?: string | null;
    modelName?: string | null;
    writingStyle?: string | null;
  } | null;
}): Promise<PaperWritingDraft> {
  const paper = await db.getPaperById(options.paperId);
  if (!paper) throw new Error("Paper not found");

  const figureSections = await db.getPaperFigureSections(options.paperId);
  const notes = await db.getPaperNotes(options.paperId);

  const figures = figureSections
    .filter((s) => Boolean(s.dataType))
    .map((s) => ({
      dataType: s.dataType!,
      title: s.title,
      captionZh: s.figureCaptionZh || "",
      captionEn: s.figureCaptionEn || "",
      analysisZh: truncate(s.content, 1200),
      analysisEn: truncate(s.contentEn, 1200),
    }));

  const noteSummaries = notes.slice(0, 12).map((n) => ({
    category: n.category,
    title: n.title,
    content: truncate(n.content, 360),
  }));

  const style = getDefaultStyle(options.userSettings?.writingStyle);
  const queryByPart: Record<PaperWritingPartType, string> = {
    body: "方法 结果 讨论 图表 数据 证据",
    introduction: "研究背景 研究问题 文献 缺口 贡献",
    conclusion: "结论 贡献 局限 未来工作",
    abstract: "摘要 方法 结果 结论 关键词",
    title: "研究主题 贡献 关键词 标题",
  };

  const rag = await getPaperAIContext(options.paperId, 99999, {
    query: queryByPart[options.partType],
    phase: "expand",
    recentCount: 2,
    ragLimit: 6,
    noteRagLimit: 6,
    userApiKey: options.userSettings?.apiKey || undefined,
    userBaseUrl: options.userSettings?.apiBaseUrl || undefined,
    userModel: options.userSettings?.modelName || undefined,
    provider: "hybrid",
  });

  const userPrompt = `Paper context (do not copy verbatim; synthesize):
${JSON.stringify(
  {
    paper: {
      title: paper.title,
      description: paper.description || "",
    },
    writingStyle: style,
    existingDrafts: {
      titleZh: paper.aiTitleZh || "",
      titleEn: paper.aiTitleEn || "",
      abstractZh: truncate(paper.aiAbstractZh, 600),
      abstractEn: truncate(paper.aiAbstractEn, 600),
      introductionZh: truncate(paper.aiIntroductionZh, 800),
      introductionEn: truncate(paper.aiIntroductionEn, 800),
      bodyZh: truncate(paper.aiBodyZh, 800),
      bodyEn: truncate(paper.aiBodyEn, 800),
      conclusionZh: truncate(paper.aiConclusionZh, 600),
      conclusionEn: truncate(paper.aiConclusionEn, 600),
      keywordsZh: paper.aiKeywordsZh || "",
      keywordsEn: paper.aiKeywordsEn || "",
    },
    figures,
    notes: noteSummaries,
    knowledge: {
      providerUsed: rag.providerUsed,
      ragContext: truncate(rag.ragContext, 2400),
      noteRagContext: truncate(rag.noteRagContext, 1400),
      structuredNotesContext: truncate(rag.structuredNotesContext, 1400),
      sources: (rag.sources || []).slice(0, 12),
    },
  },
  null,
  2
)}
`;

  const result = await chatJson<PaperWritingDraft>({
    messages: [
      { role: "system", content: partSystemPrompt(options.partType) },
      { role: "user", content: userPrompt },
    ],
    userApiKey: options.userSettings?.apiKey || undefined,
    userBaseUrl: options.userSettings?.apiBaseUrl || undefined,
    userModel: options.userSettings?.modelName || undefined,
    temperature: 0.4,
    maxTokens: options.partType === "body" ? 4096 : 2600,
    repairOnce: true,
  });

  return {
    zh: String(result.zh || "").trim(),
    en: String(result.en || "").trim(),
    keywordsZh:
      typeof result.keywordsZh === "string" ? result.keywordsZh.trim() : undefined,
    keywordsEn:
      typeof result.keywordsEn === "string" ? result.keywordsEn.trim() : undefined,
    providerUsed: rag.providerUsed,
    sources: rag.sources || [],
  };
}
