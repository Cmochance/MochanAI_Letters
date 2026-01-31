import { invokeLLM, callUserAPI } from "./llm.js";
import * as db from "../db/queries.js";
import { getAIContext, buildContextPrompt } from "./rag.js";

/**
 * Generate chapter outline using AI
 * Uses RAG to retrieve relevant context from the novel's knowledge base
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
): Promise<{
  theme: string;
  framework: string;
  conflicts: string;
  interactions: string;
  hasEmbeddings: boolean;
}> {
  // Get context from RAG and recent chapters
  // Use a query that helps find relevant plot points and character arcs
  const query = `第${chapterNumber}章 情节发展 人物关系 冲突`;
  const context = await getAIContext(novelId, chapterNumber, {
    query,
    recentCount: 3,
    ragLimit: 5,
    userApiKey: embeddingApiKey,
    userBaseUrl: embeddingBaseUrl,
    userModel: embeddingModel,
  });

  // Build prompt
  const prompt = buildOutlinePrompt(context, chapterNumber);

  // Call AI (use user's API if provided, otherwise use built-in)
  const response = await callAI(prompt, userApiKey, userBaseUrl, userModel);

  // Parse response
  const outline = parseOutlineResponse(response);
  return {
    ...outline,
    hasEmbeddings: context.hasEmbeddings,
  };
}

/**
 * Expand chapter content from outline
 * Uses RAG to maintain consistency with the novel's established world and characters
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
  // Get recent chapters for style reference
  const recentChapters = await db.getRecentChapters(novelId, 2);

  // Get RAG context using the outline as query
  // This helps find relevant background information for the content being written
  const ragResults = await getAIContext(novelId, 999, {
    query: outline.slice(0, 500), // Use outline as search query
    recentCount: 2,
    ragLimit: 5,
    userApiKey: embeddingApiKey,
    userBaseUrl: embeddingBaseUrl,
    userModel: embeddingModel,
  });

  // Build prompt
  const prompt = buildExpansionPrompt(
    outline,
    writingStyle,
    recentChapters,
    ragResults.ragContext,
    targetWords
  );

  // Call AI
  const content = await callAI(prompt, userApiKey, userBaseUrl, userModel);

  return content;
}

/**
 * Build prompt for chapter outline generation
 */
function buildOutlinePrompt(
  context: {
    ragContext: string;
    recentChapters: Array<{ number: number; title: string; content: string; summary?: string }>;
    hasEmbeddings: boolean;
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

【小说背景】
${context.ragContext || "暂无背景信息"}

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
- 推动主线剧情发展
- 符合小说整体风格
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

/**
 * Build prompt for content expansion
 */
function buildExpansionPrompt(
  outline: string,
  writingStyle: string | null,
  recentChapters: Array<{ chapterNumber: number; content: string }>,
  ragContext: string,
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

【相关背景】
${ragContext.substring(0, 1000) || "暂无背景"}

【章节大纲】
${outline}

【任务要求】
1. 根据大纲扩写为约 ${targetWords} 字的完整章节
2. 模仿上述写作风格
3. 保持与前文的连贯性
4. 情节生动,对话自然
5. 注重细节描写和心理刻画

请直接输出完整的章节内容,不要包含任何说明文字:`;
}

/**
 * Parse outline response
 */
function parseOutlineResponse(response: string): {
  theme: string;
  framework: string;
  conflicts: string;
  interactions: string;
} {
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

/**
 * Call AI with user's API or built-in LLM
 */
async function callAI(
  prompt: string,
  userApiKey?: string,
  userBaseUrl?: string,
  userModel?: string
): Promise<string> {
  if (userApiKey && userBaseUrl) {
    // Use user's OpenAI-compatible API
    return callUserAPI(prompt, userApiKey, userBaseUrl, userModel || "gpt-4");
  } else {
    // Use built-in LLM
    const response = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
    });
    const content = response.choices[0].message.content;
    return typeof content === "string" ? content : JSON.stringify(content);
  }
}
