import * as db from "../db";
import { Novel, Chapter } from "../../drizzle/schema";

/**
 * Export novel to TXT format
 */
export async function exportToTXT(novelId: number): Promise<string> {
  const novel = await db.getNovelById(novelId);
  if (!novel) {
    throw new Error("Novel not found");
  }

  const chapters = await db.getNovelChapters(novelId);
  
  let content = "";
  
  // Title
  content += `${novel.title}\n`;
  content += `${"=".repeat(novel.title.length)}\n\n`;
  
  // Description
  if (novel.description) {
    content += `${novel.description}\n\n`;
  }
  
  // Stats
  content += `总字数: ${novel.totalWords.toLocaleString()}\n`;
  content += `章节数: ${chapters.length}\n`;
  content += `更新时间: ${new Date(novel.updatedAt).toLocaleString()}\n\n`;
  content += `${"-".repeat(50)}\n\n`;
  
  // Chapters
  for (const chapter of chapters) {
    content += `第 ${chapter.chapterNumber} 章 ${chapter.title}\n\n`;
    content += `${chapter.content}\n\n`;
    content += `${"-".repeat(50)}\n\n`;
  }
  
  return content;
}

/**
 * Export novel to Markdown format (intermediate format for DOCX/PDF)
 */
export async function exportToMarkdown(novelId: number): Promise<string> {
  const novel = await db.getNovelById(novelId);
  if (!novel) {
    throw new Error("Novel not found");
  }

  const chapters = await db.getNovelChapters(novelId);
  
  let content = "";
  
  // Title
  content += `# ${novel.title}\n\n`;
  
  // Description
  if (novel.description) {
    content += `> ${novel.description}\n\n`;
  }
  
  // Stats
  content += `**总字数**: ${novel.totalWords.toLocaleString()}  \n`;
  content += `**章节数**: ${chapters.length}  \n`;
  content += `**更新时间**: ${new Date(novel.updatedAt).toLocaleString()}\n\n`;
  content += `---\n\n`;
  
  // Chapters
  for (const chapter of chapters) {
    content += `## 第 ${chapter.chapterNumber} 章 ${chapter.title}\n\n`;
    content += `${chapter.content}\n\n`;
  }
  
  return content;
}

/**
 * Generate export filename
 */
export function generateExportFilename(novel: Novel, format: "txt" | "docx" | "pdf"): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedTitle = novel.title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
  return `${sanitizedTitle}_${timestamp}.${format}`;
}

/**
 * Get export file info
 */
export async function getExportInfo(novelId: number) {
  const novel = await db.getNovelById(novelId);
  if (!novel) {
    throw new Error("Novel not found");
  }

  const chapters = await db.getNovelChapters(novelId);
  
  return {
    title: novel.title,
    description: novel.description,
    totalWords: novel.totalWords,
    chapterCount: chapters.length,
    updatedAt: novel.updatedAt,
  };
}
