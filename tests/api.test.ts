import { describe, it, expect } from "vitest";
import * as db from "../server/db";
import { splitTextIntoChunks, generateEmbedding } from "../server/services/rag";
import { countWords } from "../server/services/ai";

describe("Database Functions", () => {
  it("should count words correctly", () => {
    const text1 = "这是一个测试文本";
    const count1 = countWords(text1);
    expect(count1).toBe(8);

    const text2 = "Hello world 你好世界";
    const count2 = countWords(text2);
    expect(count2).toBe(6);
  });
});

describe("RAG Functions", () => {
  it("should split text into chunks", () => {
    const text = "这是一段很长的文本。".repeat(100);
    const chunks = splitTextIntoChunks(text, 100, 20);
    
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(100);
  });

  it("should generate embedding vector", async () => {
    const text = "这是一个测试文本";
    const embedding = await generateEmbedding(text);
    
    expect(embedding).toBeInstanceOf(Array);
    expect(embedding.length).toBe(1536);
    expect(embedding.every((val) => typeof val === "number")).toBe(true);
  });
});

describe("Word Count", () => {
  it("should count Chinese characters", () => {
    const text = "这是一个测试";
    const count = countWords(text);
    expect(count).toBe(6);
  });

  it("should count English words", () => {
    const text = "Hello world test";
    const count = countWords(text);
    expect(count).toBe(3);
  });

  it("should count mixed content", () => {
    const text = "Hello 世界 test 测试";
    const count = countWords(text);
    expect(count).toBe(6);
  });
});
