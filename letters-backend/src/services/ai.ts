import { invokeLLM, callUserAPI } from "./llm.js";
import * as db from "../db/queries.js";
import { getAIContext, getPaperAIContext } from "./rag.js";

export interface OutlinePayload {
  theme: string;
  framework: string;
  conflicts: string;
  interactions: string;
}

export function outlineToText(outline: OutlinePayload): string {
  return `${outline.theme}\n\n${outline.framework}\n\n${outline.conflicts}\n\n${outline.interactions}`;
}

/**
 * Generate chapter outline using AI with mixed novel context
 */
export async function generateChapterOutline(
  novelId: number,
  chapterNumber: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string,
  embeddingApiKey?: string,
  embeddingBaseUrl?: string,
  embeddingModel?: string
): Promise<OutlinePayload & { hasEmbeddings: boolean }> {
  const query = `第${chapterNumber}章 情节发展 人物关系 冲突 灵感`;

  const context = await getAIContext(novelId, chapterNumber, {
    query,
    phase: "outline",
    recentCount: 3,
    ragLimit: 5,
    noteRagLimit: 6,
    userApiKey: embeddingApiKey,
    userBaseUrl: embeddingBaseUrl,
    userModel: embeddingModel,
  });

  const prompt = buildNovelOutlinePrompt(context, chapterNumber);
  const response = await callAI(prompt, userApiKey, userBaseUrl, userModel);

  const outline = parseOutlineResponse(response);
  return {
    ...outline,
    hasEmbeddings: context.hasEmbeddings,
  };
}

/**
 * Expand chapter content from outline using mixed novel context
 */
export async function expandChapterContent(
  novelId: number,
  outline: string,
  writingStyle: string | null,
  targetWords: number = 4000,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string,
  embeddingApiKey?: string,
  embeddingBaseUrl?: string,
  embeddingModel?: string
): Promise<string> {
  const context = await getAIContext(novelId, 99999, {
    query: outline.slice(0, 500),
    phase: "expand",
    recentCount: 2,
    ragLimit: 5,
    noteRagLimit: 6,
    userApiKey: embeddingApiKey,
    userBaseUrl: embeddingBaseUrl,
    userModel: embeddingModel,
  });

  const prompt = buildNovelExpansionPrompt(
    outline,
    writingStyle,
    context.recentChapters.map((ch) => ({
      chapterNumber: ch.number,
      content: ch.content,
    })),
    context.ragContext,
    context.structuredNotesContext,
    context.noteRagContext,
    targetWords
  );

  const content = await callAI(prompt, userApiKey, userBaseUrl, userModel);
  return content;
}

function normalizePoeticTitle(raw: string): string | null {
  const firstLine = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return null;

  let text = firstLine
    .replace(/^["'“”《》【】\[\]]+|["'“”《》【】\[\]]+$/g, "")
    .replace(/^(标题|章节名|章名)\s*[:：]\s*/u, "")
    .replace(/\s+/g, "")
    .replace(/[。！？!?.；;：:]+$/u, "");

  if (!text) return null;

  const parts = text.split(/[，,。；;、]/u).filter(Boolean);
  let left = "";
  let right = "";

  if (parts.length >= 2) {
    [left, right] = parts;
  } else if (text.length === 14) {
    left = text.slice(0, 7);
    right = text.slice(7);
  } else {
    return null;
  }

  const han7 = /^[\u4e00-\u9fff]{7}$/u;
  if (!han7.test(left) || !han7.test(right)) {
    return null;
  }

  return `${left}，${right}`;
}

function fallbackPoeticTitle(chapterNumber: number): string {
  const presets = [
    "云起苍岚映古城，风回幽壑动寒星",
    "月照寒溪鸣古木，霜侵远岫锁孤灯",
    "雪压青松沉夜色，风摇古渡起潮声",
    "雨过长街浮旧梦，灯临短巷照新痕",
    "雾隐孤峰藏古道，潮生远岸唤归舟",
    "星坠寒江惊夜鹭，风过古渡动秋声",
  ];
  return presets[Math.abs(chapterNumber) % presets.length];
}

function buildChapterTitlePrompt(
  chapterNumber: number,
  content: string,
  outline?: string
): string {
  return `你是一位擅长古典文学题名的编辑。请为第 ${chapterNumber} 章拟一个章节名。

要求：
1. 必须是“七言对句”格式：前7字 + 中文逗号 + 后7字。
2. 前后语义呼应、意象对称，风格接近古诗。
3. 只能输出标题本身，不要解释，不要引号，不要额外符号。
4. 不要出现数字、英文、书名号。

${outline ? `【章节大纲】\n${outline.substring(0, 800)}\n` : ""}
【章节正文片段】
${content.substring(0, 1800)}
`;
}

export async function generateChapterPoeticTitle(
  chapterNumber: number,
  content: string,
  outline?: string,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<string> {
  const prompt = buildChapterTitlePrompt(chapterNumber, content, outline);
  const response = await callAI(prompt, userApiKey, userBaseUrl, userModel);
  const normalized = normalizePoeticTitle(response);
  if (normalized) return normalized;

  const repairPrompt = `请将下面的标题改写为“前7字，后7字”的七言对句，只输出改写后的标题：\n${response}`;
  const repaired = await callAI(repairPrompt, userApiKey, userBaseUrl, userModel);
  const normalizedRepaired = normalizePoeticTitle(repaired);
  if (normalizedRepaired) return normalizedRepaired;

  return fallbackPoeticTitle(chapterNumber);
}

/**
 * Generate paper section outline (academic)
 */
export async function generatePaperOutline(
  paperId: number,
  sectionNumber: number,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string,
  embeddingApiKey?: string,
  embeddingBaseUrl?: string,
  embeddingModel?: string
): Promise<OutlinePayload & { hasEmbeddings: boolean }> {
  const query = `第${sectionNumber}节 研究问题 方法 证据 论证`;

  const context = await getPaperAIContext(paperId, sectionNumber, {
    query,
    phase: "outline",
    recentCount: 2,
    ragLimit: 5,
    noteRagLimit: 6,
    userApiKey: embeddingApiKey,
    userBaseUrl: embeddingBaseUrl,
    userModel: embeddingModel,
  });

  const prompt = buildPaperOutlinePrompt(context, sectionNumber);
  const response = await callAI(prompt, userApiKey, userBaseUrl, userModel);

  const outline = parseOutlineResponse(response);
  return {
    ...outline,
    hasEmbeddings: context.hasEmbeddings,
  };
}

/**
 * Expand paper section content from outline (academic)
 */
export async function expandPaperContent(
  paperId: number,
  outline: string,
  writingStyle: string | null,
  targetWords: number = 2500,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string,
  embeddingApiKey?: string,
  embeddingBaseUrl?: string,
  embeddingModel?: string
): Promise<string> {
  const context = await getPaperAIContext(paperId, 99999, {
    query: outline.slice(0, 500),
    phase: "expand",
    recentCount: 2,
    ragLimit: 5,
    noteRagLimit: 6,
    userApiKey: embeddingApiKey,
    userBaseUrl: embeddingBaseUrl,
    userModel: embeddingModel,
  });

  const prompt = buildPaperExpansionPrompt(
    outline,
    writingStyle,
    context.recentSections.map((section) => ({
      sectionNumber: section.number,
      content: section.content,
    })),
    context.ragContext,
    context.structuredNotesContext,
    context.noteRagContext,
    targetWords
  );

  return callAI(prompt, userApiKey, userBaseUrl, userModel);
}

function buildNovelOutlinePrompt(
  context: {
    ragContext: string;
    noteRagContext: string;
    structuredNotesContext: string;
    recentChapters: Array<{ number: number; title: string; content: string; summary?: string }>;
  },
  chapterNumber: number
): string {
  const recentChaptersText = context.recentChapters
    .map(
      (ch) =>
        `【第 ${ch.number} 章：${ch.title}】\n${(ch.summary || ch.content).substring(0, 500)}...`
    )
    .join("\n\n");

  return `你是一位资深小说编辑,正在帮助作者规划下一章节。

【小说背景（正文知识库）】
${context.ragContext || "暂无背景信息"}

【灵感笔记（分类知识库）】
${context.structuredNotesContext || "暂无分类笔记"}

【灵感笔记（语义检索）】
${context.noteRagContext || "暂无语义检索笔记"}

【前文回顾】
${recentChaptersText || "这是第一章"}

【任务】
请为第 ${chapterNumber} 章提供详细的章节规划,包括:

1. 章节主题建议
2. 情节发展框架
3. 关键冲突点
4. 人物互动要点

要求:
- 保持与前文的连贯性
- 优先利用灵感笔记中已定义的人物、世界观、情节约束
- 推动主线剧情发展
- 具体且可操作

请按照以下格式输出:

【章节主题】
(在此填写章节主题)

【情节框架】
(在此填写情节发展框架)

【关键冲突】
(在此填写关键冲突点)

【人物互动】
(在此填写人物互动要点)`;
}

function buildNovelExpansionPrompt(
  outline: string,
  writingStyle: string | null,
  recentChapters: Array<{ chapterNumber: number; content: string }>,
  ragContext: string,
  structuredNotesContext: string,
  noteRagContext: string,
  targetWords: number
): string {
  const styleDescription = writingStyle || "简洁明快,注重情节推进";

  const recentText = recentChapters
    .map(
      (ch) =>
        `【第 ${ch.chapterNumber} 章片段】\n${ch.content.substring(0, 300)}...`
    )
    .join("\n\n");

  return `你是一位专业的小说作家,需要根据章节大纲扩写为完整的章节内容。

【写作风格】
${styleDescription}

【前文参考】
${recentText || "这是第一章"}

【正文知识库】
${ragContext.substring(0, 1200) || "暂无背景"}

【灵感笔记（分类）】
${structuredNotesContext.substring(0, 1200) || "暂无分类笔记"}

【灵感笔记（语义检索）】
${noteRagContext.substring(0, 1000) || "暂无语义检索笔记"}

【章节大纲】
${outline}

【任务要求】
1. 根据大纲扩写为约 ${targetWords} 字的完整章节
2. 模仿上述写作风格
3. 保持与前文的连贯性
4. 严格遵守灵感笔记中的设定与约束
5. 情节生动,对话自然
6. 注重细节描写和心理刻画

请直接输出完整的章节内容,不要包含任何说明文字:`;
}

function buildPaperOutlinePrompt(
  context: {
    ragContext: string;
    noteRagContext: string;
    structuredNotesContext: string;
    recentSections: Array<{ number: number; title: string; content: string; summary?: string }>;
  },
  sectionNumber: number
): string {
  const recentSectionsText = context.recentSections
    .map(
      (section) =>
        `【第 ${section.number} 节：${section.title}】\n${(
          section.summary || section.content
        ).substring(0, 450)}...`
    )
    .join("\n\n");

  return `你是一位学术写作顾问，正在帮助作者规划论文下一节。

【相关文稿（正文知识库）】
${context.ragContext || "暂无正文参考"}

【研究笔记（分类知识库）】
${context.structuredNotesContext || "暂无研究笔记"}

【研究笔记（语义检索）】
${context.noteRagContext || "暂无语义检索笔记"}

【前文回顾】
${recentSectionsText || "这是第一节"}

【任务】
请为第 ${sectionNumber} 节给出可执行规划，并按四段输出：
- 核心论点（章节主题）
- 论证结构（情节框架）
- 关键争议/风险（关键冲突）
- 证据与段落衔接（人物互动）

要求：
- 保持学术严谨与逻辑连贯
- 明确研究问题、方法、证据链
- 与已有文稿和研究笔记一致

请严格按以下格式输出：

【章节主题】
(在此填写核心论点)

【情节框架】
(在此填写论证结构)

【关键冲突】
(在此填写关键争议与风险)

【人物互动】
(在此填写证据与段落衔接)`;
}

function buildPaperExpansionPrompt(
  outline: string,
  writingStyle: string | null,
  recentSections: Array<{ sectionNumber: number; content: string }>,
  ragContext: string,
  structuredNotesContext: string,
  noteRagContext: string,
  targetWords: number
): string {
  const styleDescription =
    writingStyle || "学术严谨、结构清晰、结论有证据支撑";

  const recentText = recentSections
    .map(
      (section) =>
        `【第 ${section.sectionNumber} 节片段】\n${section.content.substring(0, 280)}...`
    )
    .join("\n\n");

  return `你是一位学术写作专家，需要根据提纲扩写论文正文。

【写作风格】
${styleDescription}

【前文参考】
${recentText || "这是第一节"}

【正文知识库】
${ragContext.substring(0, 1200) || "暂无正文知识"}

【研究笔记（分类）】
${structuredNotesContext.substring(0, 1200) || "暂无分类研究笔记"}

【研究笔记（语义检索）】
${noteRagContext.substring(0, 1000) || "暂无语义检索研究笔记"}

【章节提纲】
${outline}

【任务要求】
1. 根据提纲扩写约 ${targetWords} 字学术正文
2. 论点-论据-论证链条清晰
3. 使用客观、规范的学术表达
4. 与前文术语与结论保持一致
5. 必要时标记“[需补引文]”

直接输出章节正文，不要输出解释说明。`;
}

function parseOutlineResponse(response: string): OutlinePayload {
  const themeMatch = response.match(/【章节主题】\s*([\s\S]*?)(?=【|$)/);
  const frameworkMatch = response.match(/【情节框架】\s*([\s\S]*?)(?=【|$)/);
  const conflictsMatch = response.match(/【关键冲突】\s*([\s\S]*?)(?=【|$)/);
  const interactionsMatch = response.match(/【人物互动】\s*([\s\S]*?)(?=【|$)/);

  return {
    theme: themeMatch ? themeMatch[1].trim() : "暂无主题建议",
    framework: frameworkMatch ? frameworkMatch[1].trim() : "暂无框架建议",
    conflicts: conflictsMatch ? conflictsMatch[1].trim() : "暂无冲突建议",
    interactions: interactionsMatch
      ? interactionsMatch[1].trim()
      : "暂无互动建议",
  };
}

async function callAI(
  prompt: string,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<string> {
  if (userApiKey && userBaseUrl) {
    return callUserAPI(prompt, userApiKey, userBaseUrl, userModel || "gpt-4");
  }

  const response = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
  });
  const content = response.choices[0].message.content;
  return typeof content === "string" ? content : JSON.stringify(content);
}

export async function getOutlineFromStoredPlan(
  userId: number,
  planDocumentId: number,
  requestedVersion?: number
): Promise<OutlinePayload | null> {
  const document = await db.getPlanDocumentById(userId, planDocumentId);
  if (!document) {
    return null;
  }

  const version =
    requestedVersion !== undefined
      ? await db.getPlanVersion(planDocumentId, requestedVersion)
      : await db.getLatestPlanVersion(planDocumentId);

  if (!version) {
    return null;
  }

  return {
    theme: version.theme,
    framework: version.framework,
    conflicts: version.conflicts,
    interactions: version.interactions,
  };
}
