import * as db from "../db/queries.js";
import type { Paper } from "../db/schema.js";

export async function exportPaperToTXT(paperId: number): Promise<string> {
  const paper = await db.getPaperById(paperId);
  if (!paper) throw new Error("Paper not found");

  const sections = await db.getPaperSections(paperId);

  let content = `${paper.title}\n`;
  content += "=".repeat(Math.max(10, paper.title.length * 2)) + "\n\n";

  if (paper.description) {
    content += `${paper.description}\n\n`;
    content += "-".repeat(60) + "\n\n";
  }

  for (const section of sections) {
    content += `第 ${section.sectionNumber} 节 ${section.title}\n\n`;
    content += `${section.content}\n\n`;
    content += "-".repeat(60) + "\n\n";
  }

  return content;
}

export async function exportPaperToMarkdown(paperId: number): Promise<string> {
  const paper = await db.getPaperById(paperId);
  if (!paper) throw new Error("Paper not found");

  const sections = await db.getPaperSections(paperId);

  let content = `# ${paper.title}\n\n`;

  if (paper.description) {
    content += `> ${paper.description}\n\n`;
    content += "---\n\n";
  }

  for (const section of sections) {
    content += `## 第 ${section.sectionNumber} 节 ${section.title}\n\n`;
    content += `${section.content}\n\n`;
  }

  return content;
}

export function generatePaperExportFilename(
  paper: Paper,
  format: "txt" | "md"
): string {
  const timestamp = new Date().toISOString().split("T")[0];
  const sanitizedTitle = paper.title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
  return `${sanitizedTitle}_${timestamp}.${format}`;
}
