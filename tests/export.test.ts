import { describe, it, expect } from "vitest";
import { generateExportFilename } from "../server/services/export";
import { Novel } from "../drizzle/schema";

describe("Export Functions", () => {
  it("should generate correct TXT filename", () => {
    const novel: Partial<Novel> = {
      id: 1,
      title: "测试小说",
      totalWords: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const filename = generateExportFilename(novel as Novel, "txt");
    expect(filename).toMatch(/测试小说_\d{4}-\d{2}-\d{2}\.txt/);
  });

  it("should generate correct DOCX filename", () => {
    const novel: Partial<Novel> = {
      id: 1,
      title: "My Novel",
      totalWords: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const filename = generateExportFilename(novel as Novel, "docx");
    expect(filename).toMatch(/My_Novel_\d{4}-\d{2}-\d{2}\.docx/);
  });

  it("should sanitize special characters in filename", () => {
    const novel: Partial<Novel> = {
      id: 1,
      title: "小说@#$%名称!",
      totalWords: 10000,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const filename = generateExportFilename(novel as Novel, "txt");
    expect(filename).not.toContain("@");
    expect(filename).not.toContain("#");
    expect(filename).not.toContain("$");
    expect(filename).not.toContain("%");
    expect(filename).not.toContain("!");
  });
});
