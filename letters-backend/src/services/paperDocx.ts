import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type * as db from "../db/queries.js";
import { downloadFileBuffer } from "./storage.js";

type Lang = "zh" | "en";

export interface PaperDocxFigure {
  dataType: db.PaperDataTypeValue;
  key: string;
  contentType: string | null;
  captionZh: string | null;
  captionEn: string | null;
  fallbackTitle: string;
}

function markerDataType(line: string): db.PaperDataTypeValue | null {
  const match = line.trim().match(/^\[\[FIGURE:([a-z_]+)\]\]$/);
  if (!match) return null;
  return match[1] as db.PaperDataTypeValue;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ""))
    .reduce<string[]>((acc, line) => {
      // Preserve blank lines as paragraph breaks
      acc.push(line);
      return acc;
    }, []);
}

async function getImageDimensions(
  buffer: Buffer
): Promise<{ width: number; height: number } | null> {
  try {
    const mod: any = await import("image-size");
    const fn = mod?.imageSize || mod?.default;
    if (typeof fn !== "function") return null;
    const result = fn(buffer);
    const width = Number(result?.width);
    const height = Number(result?.height);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return { width, height };
  } catch {
    return null;
  }
}

function scaleToFit(
  size: { width: number; height: number },
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const wRatio = maxWidth / size.width;
  const hRatio = maxHeight / size.height;
  const ratio = Math.min(wRatio, hRatio, 1);
  return {
    width: Math.round(size.width * ratio),
    height: Math.round(size.height * ratio),
  };
}

function heading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { after: 200 },
  });
}

function normalParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text })],
    spacing: { after: 120 },
  });
}

function emptyParagraph(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "" })],
    spacing: { after: 120 },
  });
}

async function buildFigureBlocks(options: {
  figure: PaperDocxFigure;
  lang: Lang;
  bufferCache: Map<string, Buffer>;
  dimensionCache: Map<string, { width: number; height: number }>;
}): Promise<Paragraph[]> {
  const cacheKey = options.figure.key;
  let buffer = options.bufferCache.get(cacheKey);
  if (!buffer) {
    buffer = await downloadFileBuffer(cacheKey);
    options.bufferCache.set(cacheKey, buffer);
  }

  let dims = options.dimensionCache.get(cacheKey);
  if (!dims) {
    dims = (await getImageDimensions(buffer)) || { width: 1200, height: 800 };
    options.dimensionCache.set(cacheKey, dims);
  }

  const scaled = scaleToFit(dims, 560, 420);
  const imageType =
    options.figure.contentType?.includes("png")
      ? ("png" as const)
      : options.figure.contentType?.includes("jpeg") ||
          options.figure.contentType?.includes("jpg")
        ? ("jpg" as const)
        : ("png" as const);
  const caption =
    options.lang === "zh"
      ? options.figure.captionZh || options.figure.fallbackTitle
      : options.figure.captionEn || options.figure.fallbackTitle;

  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: imageType,
          data: buffer,
          transformation: {
            width: scaled.width,
            height: scaled.height,
          },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: caption,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    }),
  ];
}

export async function generatePaperDocx(options: {
  lang: Lang;
  title: string;
  abstractText: string;
  keywordsText: string;
  introductionText: string;
  bodyText: string;
  conclusionText: string;
  figures: PaperDocxFigure[];
  caches?: {
    bufferCache: Map<string, Buffer>;
    dimensionCache: Map<string, { width: number; height: number }>;
  };
}): Promise<Buffer> {
  const usedFigures = new Set<db.PaperDataTypeValue>();
  const figureMap = new Map<db.PaperDataTypeValue, PaperDocxFigure>();
  for (const f of options.figures) {
    figureMap.set(f.dataType, f);
  }
  const bufferCache = options.caches?.bufferCache || new Map<string, Buffer>();
  const dimensionCache =
    options.caches?.dimensionCache ||
    new Map<string, { width: number; height: number }>();

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: options.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    })
  );

  // Abstract
  children.push(heading(options.lang === "zh" ? "摘要" : "Abstract"));
  children.push(normalParagraph(options.abstractText || ""));
  if (options.keywordsText) {
    children.push(
      normalParagraph(
        `${options.lang === "zh" ? "关键词" : "Keywords"}: ${options.keywordsText}`
      )
    );
  }

  // Introduction
  children.push(heading(options.lang === "zh" ? "简介" : "Introduction"));
  for (const line of splitIntoParagraphs(options.introductionText || "")) {
    if (!line.trim()) {
      children.push(emptyParagraph());
      continue;
    }
    children.push(normalParagraph(line));
  }

  // Body
  children.push(heading(options.lang === "zh" ? "文章主体" : "Main Body"));
  for (const line of splitIntoParagraphs(options.bodyText || "")) {
    const dt = markerDataType(line);
    if (dt && figureMap.has(dt)) {
      usedFigures.add(dt);
      const blocks = await buildFigureBlocks({
        figure: figureMap.get(dt)!,
        lang: options.lang,
        bufferCache,
        dimensionCache,
      });
      children.push(...blocks);
      continue;
    }

    if (!line.trim()) {
      children.push(emptyParagraph());
      continue;
    }
    children.push(normalParagraph(line));
  }

  // Missing figures as appendix
  const missing = options.figures.filter((f) => !usedFigures.has(f.dataType));
  if (missing.length > 0) {
    children.push(heading(options.lang === "zh" ? "图表" : "Figures"));
    for (const f of missing) {
      const blocks = await buildFigureBlocks({
        figure: f,
        lang: options.lang,
        bufferCache,
        dimensionCache,
      });
      children.push(...blocks);
    }
  }

  // Conclusion
  children.push(heading(options.lang === "zh" ? "结论" : "Conclusion"));
  for (const line of splitIntoParagraphs(options.conclusionText || "")) {
    if (!line.trim()) {
      children.push(emptyParagraph());
      continue;
    }
    children.push(normalParagraph(line));
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
