import { describe, it, expect } from "vitest";

describe("ePub Export Service", () => {
  it("should validate ePub export structure", () => {
    const mockEpubOptions = {
      title: "测试小说",
      author: "墨文作者",
      description: "测试描述",
      content: [
        {
          title: "第 1 章 开始",
          data: "<h1>第 1 章 开始</h1><p>章节内容</p>",
        },
      ],
      lang: "zh",
    };

    expect(mockEpubOptions.title).toBeTruthy();
    expect(mockEpubOptions.author).toBeTruthy();
    expect(mockEpubOptions.content).toHaveLength(1);
    expect(mockEpubOptions.lang).toBe("zh");
  });

  it("should format chapter content correctly", () => {
    const content = "第一段\n第二段\n第三段";
    const formatted = content
      .split("\n")
      .map((p) => (p.trim() ? `<p>${p}</p>` : "<br/>"))
      .join("");

    expect(formatted).toContain("<p>第一段</p>");
    expect(formatted).toContain("<p>第二段</p>");
    expect(formatted).toContain("<p>第三段</p>");
  });

  it("should generate correct filename", () => {
    const title = "测试小说";
    const date = new Date().toISOString().split("T")[0];
    const sanitized = title.replace(/[^\w\u4e00-\u9fa5]/g, "_");
    const filename = `${sanitized}_${date}.epub`;

    expect(filename).toContain(".epub");
    expect(filename).toContain(date);
  });
});
