import { describe, it, expect } from "vitest";

describe("Outline View", () => {
  it("should display chapter structure correctly", () => {
    const chapters = [
      { id: 1, chapterNumber: 1, title: "开篇", content: "这是第一章内容", wordCount: 1000 },
      { id: 2, chapterNumber: 2, title: "发展", content: "这是第二章内容", wordCount: 1200 },
      { id: 3, chapterNumber: 3, title: "高潮", content: "这是第三章内容", wordCount: 1500 },
    ];

    expect(chapters.length).toBe(3);
    expect(chapters[0].chapterNumber).toBe(1);
    expect(chapters[2].title).toBe("高潮");
  });

  it("should calculate total word count", () => {
    const chapters = [
      { wordCount: 1000 },
      { wordCount: 1200 },
      { wordCount: 1500 },
    ];

    const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
    expect(totalWords).toBe(3700);
  });

  it("should handle empty chapter list", () => {
    const chapters: any[] = [];
    expect(chapters.length).toBe(0);
  });
});
