import epub from "epub-gen-memory";
import * as db from "../db/queries.js";
import type { Novel } from "../db/schema.js";
import {
  uploadFile,
  generateFileKey,
  isStorageConfigured,
  getDownloadUrl,
} from "./storage.js";

/**
 * Export novel to TXT format
 */
export async function exportToTXT(novelId: number): Promise<string> {
  const novel = await db.getNovelById(novelId);
  if (!novel) throw new Error("Novel not found");

  const chapters = await db.getNovelChapters(novelId);

  let content = `${novel.title}\n`;
  content += "=".repeat(novel.title.length * 2) + "\n\n";

  if (novel.description) {
    content += `${novel.description}\n\n`;
    content += "-".repeat(40) + "\n\n";
  }

  for (const chapter of chapters) {
    content += `第 ${chapter.chapterNumber} 章 ${chapter.title}\n\n`;
    content += `${chapter.content}\n\n`;
    content += "-".repeat(40) + "\n\n";
  }

  return content;
}

/**
 * Export novel to Markdown format
 */
export async function exportToMarkdown(novelId: number): Promise<string> {
  const novel = await db.getNovelById(novelId);
  if (!novel) throw new Error("Novel not found");

  const chapters = await db.getNovelChapters(novelId);

  let content = `# ${novel.title}\n\n`;

  if (novel.description) {
    content += `> ${novel.description}\n\n`;
    content += "---\n\n";
  }

  for (const chapter of chapters) {
    content += `## 第 ${chapter.chapterNumber} 章 ${chapter.title}\n\n`;
    content += `${chapter.content}\n\n`;
  }

  return content;
}

/**
 * Export novel to ePub format
 */
export async function exportToEPub(novelId: number): Promise<Buffer> {
  const novel = await db.getNovelById(novelId);
  if (!novel) throw new Error("Novel not found");

  const chapters = await db.getNovelChapters(novelId);

  const epubContent = chapters.map((chapter) => ({
    title: `第 ${chapter.chapterNumber} 章 ${chapter.title}`,
    content: `<h1>第 ${chapter.chapterNumber} 章 ${chapter.title}</h1>
      ${chapter.content
        .split("\n")
        .map((p) => `<p>${p}</p>`)
        .join("")}`,
  }));

  const buffer = await epub(
    {
      title: novel.title,
      author: "Letters用户",
      description: novel.description || "",
      cover: novel.coverUrl || undefined,
      lang: "zh-CN",
    },
    epubContent
  );

  return Buffer.from(buffer);
}

/**
 * Generate export filename
 */
export function generateExportFilename(
  novel: Novel,
  format: "txt" | "md" | "epub"
): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedTitle = novel.title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
  return `${sanitizedTitle}_${timestamp}.${format}`;
}

/**
 * Export and upload to R2 storage
 * Returns a download URL that expires after the specified time
 */
export async function exportAndUpload(
  novelId: number,
  format: "txt" | "md" | "epub",
  userId: number,
  expiresIn: number = 3600
): Promise<{ downloadUrl: string; filename: string }> {
  if (!isStorageConfigured()) {
    throw new Error("R2 storage is not configured");
  }

  const novel = await db.getNovelById(novelId);
  if (!novel) throw new Error("Novel not found");

  const filename = generateExportFilename(novel, format);
  let content: Buffer | string;
  let contentType: string;

  switch (format) {
    case "txt":
      content = await exportToTXT(novelId);
      contentType = "text/plain; charset=utf-8";
      break;
    case "md":
      content = await exportToMarkdown(novelId);
      contentType = "text/markdown; charset=utf-8";
      break;
    case "epub":
      content = await exportToEPub(novelId);
      contentType = "application/epub+zip";
      break;
    default:
      throw new Error(`Unsupported format: ${format}`);
  }

  const data = typeof content === "string" ? Buffer.from(content, "utf-8") : content;
  const key = generateFileKey("exports", filename, userId);

  await uploadFile(key, data, contentType);
  const downloadUrl = await getDownloadUrl(key, expiresIn);

  return { downloadUrl, filename };
}
