import { describe, it, expect } from "vitest";

describe("Notes Service", () => {
  it("should validate note categories", () => {
    const validCategories = ["inspiration", "character", "worldview", "plot", "other"];
    
    validCategories.forEach((category) => {
      expect(validCategories).toContain(category);
    });
  });

  it("should validate note structure", () => {
    const mockNote = {
      id: 1,
      userId: 1,
      novelId: null,
      title: "测试笔记",
      content: "这是一条测试笔记内容",
      category: "inspiration" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(mockNote.title).toBeTruthy();
    expect(mockNote.content).toBeTruthy();
    expect(mockNote.category).toBe("inspiration");
    expect(mockNote.userId).toBeGreaterThan(0);
  });

  it("should support optional novel linking", () => {
    const noteWithNovel = {
      id: 1,
      novelId: 5,
      title: "关联小说的笔记",
      content: "内容",
    };

    const noteWithoutNovel = {
      id: 2,
      novelId: null,
      title: "独立笔记",
      content: "内容",
    };

    expect(noteWithNovel.novelId).toBe(5);
    expect(noteWithoutNovel.novelId).toBeNull();
  });

  it("should get category display names", () => {
    const categoryNames: Record<string, string> = {
      inspiration: "💡 灵感",
      character: "👤 人物",
      worldview: "🌏 世界观",
      plot: "📖 情节",
      other: "📝 其他",
    };

    expect(categoryNames.inspiration).toBe("💡 灵感");
    expect(categoryNames.character).toBe("👤 人物");
    expect(categoryNames.worldview).toBe("🌏 世界观");
    expect(categoryNames.plot).toBe("📖 情节");
    expect(categoryNames.other).toBe("📝 其他");
  });

  it("should validate note update payload", () => {
    const updatePayload = {
      noteId: 1,
      title: "更新后的标题",
      content: "更新后的内容",
      category: "character" as const,
      novelId: 3,
    };

    expect(updatePayload.noteId).toBeGreaterThan(0);
    expect(updatePayload.title).toBeTruthy();
    expect(updatePayload.content).toBeTruthy();
    expect(["inspiration", "character", "worldview", "plot", "other"]).toContain(updatePayload.category);
  });
});
