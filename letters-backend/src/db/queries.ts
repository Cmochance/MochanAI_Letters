import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "./index.js";
import {
  users,
  novels,
  chapters,
  chapterEmbeddings,
  userSettings,
  notes,
  type InsertUser,
  type InsertNovel,
  type InsertChapter,
  type InsertChapterEmbedding,
  type InsertUserSettings,
  type InsertNote,
} from "./schema.js";

// ============ Users ============

export async function getUserBySupabaseId(supabaseId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.supabaseId, supabaseId))
    .limit(1);
  return result[0] || null;
}

export async function createUser(data: InsertUser) {
  const result = await db.insert(users).values(data).returning({ id: users.id });
  return result[0].id;
}

export async function updateUserLastSignIn(userId: number) {
  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

// ============ Novels ============

export async function getUserNovels(userId: number) {
  return db
    .select()
    .from(novels)
    .where(eq(novels.userId, userId))
    .orderBy(desc(novels.updatedAt));
}

export async function getNovelById(novelId: number) {
  const result = await db
    .select()
    .from(novels)
    .where(eq(novels.id, novelId))
    .limit(1);
  return result[0] || null;
}

export async function createNovel(data: Omit<InsertNovel, "id">) {
  const result = await db
    .insert(novels)
    .values(data)
    .returning({ id: novels.id });
  return result[0].id;
}

export async function updateNovel(
  novelId: number,
  data: Partial<Omit<InsertNovel, "id" | "userId">>
) {
  await db
    .update(novels)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(novels.id, novelId));
}

export async function deleteNovel(novelId: number) {
  await db.delete(novels).where(eq(novels.id, novelId));
}

export async function updateNovelWordCount(novelId: number) {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${chapters.wordCount}), 0)` })
    .from(chapters)
    .where(eq(chapters.novelId, novelId));

  const totalWords = Number(result[0]?.total) || 0;
  await db
    .update(novels)
    .set({ totalWords, updatedAt: new Date() })
    .where(eq(novels.id, novelId));
}

// ============ Chapters ============

export async function getNovelChapters(novelId: number) {
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.novelId, novelId))
    .orderBy(chapters.chapterNumber);
}

export async function getChapterById(chapterId: number) {
  const result = await db
    .select()
    .from(chapters)
    .where(eq(chapters.id, chapterId))
    .limit(1);
  return result[0] || null;
}

export async function getRecentChapters(novelId: number, limit: number = 3) {
  return db
    .select()
    .from(chapters)
    .where(eq(chapters.novelId, novelId))
    .orderBy(desc(chapters.chapterNumber))
    .limit(limit);
}

export async function createChapter(data: Omit<InsertChapter, "id">) {
  const result = await db
    .insert(chapters)
    .values(data)
    .returning({ id: chapters.id });

  // Update novel word count
  await updateNovelWordCount(data.novelId);

  return result[0].id;
}

export async function updateChapter(
  chapterId: number,
  data: Partial<Omit<InsertChapter, "id" | "novelId">>
) {
  const chapter = await getChapterById(chapterId);
  if (!chapter) return;

  await db
    .update(chapters)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chapters.id, chapterId));

  // Update novel word count if content changed
  if (data.wordCount !== undefined) {
    await updateNovelWordCount(chapter.novelId);
  }
}

export async function deleteChapter(chapterId: number) {
  const chapter = await getChapterById(chapterId);
  if (!chapter) return;

  await db.delete(chapters).where(eq(chapters.id, chapterId));
  await updateNovelWordCount(chapter.novelId);
}

// ============ Chapter Embeddings ============

export async function getChapterEmbeddings(novelId: number) {
  return db
    .select()
    .from(chapterEmbeddings)
    .where(eq(chapterEmbeddings.novelId, novelId))
    .orderBy(chapterEmbeddings.chapterId, chapterEmbeddings.chunkIndex);
}

export async function deleteChapterEmbeddings(chapterId: number) {
  await db
    .delete(chapterEmbeddings)
    .where(eq(chapterEmbeddings.chapterId, chapterId));
}

export async function deleteNovelEmbeddings(novelId: number) {
  await db
    .delete(chapterEmbeddings)
    .where(eq(chapterEmbeddings.novelId, novelId));
}

export async function createChapterEmbedding(
  data: Omit<InsertChapterEmbedding, "id">
) {
  const result = await db
    .insert(chapterEmbeddings)
    .values(data)
    .returning({ id: chapterEmbeddings.id });
  return result[0].id;
}

export async function createChapterEmbeddingsBatch(
  data: Array<Omit<InsertChapterEmbedding, "id">>
) {
  if (data.length === 0) return [];
  const result = await db
    .insert(chapterEmbeddings)
    .values(data)
    .returning({ id: chapterEmbeddings.id });
  return result.map((r) => r.id);
}

/**
 * Search for similar content using pgvector cosine similarity
 * @param novelId - The novel to search within
 * @param queryEmbedding - The query embedding vector
 * @param limit - Maximum number of results
 * @returns Array of chunks with similarity scores
 */
export async function searchSimilarChunks(
  novelId: number,
  queryEmbedding: number[],
  limit: number = 10
) {
  const vectorString = `[${queryEmbedding.join(",")}]`;
  
  // Use pgvector's cosine distance operator (<=>)
  // 1 - distance = similarity (cosine similarity ranges from -1 to 1)
  const result = await db.execute(sql`
    SELECT 
      id,
      chapter_id,
      novel_id,
      content_chunk,
      chunk_index,
      1 - (embedding <=> ${vectorString}::vector) as similarity
    FROM chapter_embeddings
    WHERE novel_id = ${novelId}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `);

  return result as Array<{
    id: number;
    chapter_id: number;
    novel_id: number;
    content_chunk: string;
    chunk_index: number;
    similarity: number;
  }>;
}

export async function getEmbeddingCount(novelId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(chapterEmbeddings)
    .where(eq(chapterEmbeddings.novelId, novelId));
  return Number(result[0]?.count) || 0;
}

// ============ User Settings ============

export async function getUserSettings(userId: number) {
  const result = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return result[0] || null;
}

export async function upsertUserSettings(
  data: Omit<InsertUserSettings, "id" | "createdAt" | "updatedAt">
) {
  const existing = await getUserSettings(data.userId);

  if (existing) {
    await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.userId, data.userId));
  } else {
    await db.insert(userSettings).values(data);
  }
}

// ============ Notes ============

export async function getUserNotes(userId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.updatedAt));
}

export async function getNotesByCategory(
  userId: number,
  category: "inspiration" | "character" | "worldview" | "plot" | "other"
) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.category, category)))
    .orderBy(desc(notes.updatedAt));
}

export async function getNovelNotes(novelId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.novelId, novelId))
    .orderBy(desc(notes.updatedAt));
}

export async function getNoteById(noteId: number) {
  const result = await db
    .select()
    .from(notes)
    .where(eq(notes.id, noteId))
    .limit(1);
  return result[0] || null;
}

export async function createNote(data: Omit<InsertNote, "id">) {
  const result = await db
    .insert(notes)
    .values(data)
    .returning({ id: notes.id });
  return result[0].id;
}

export async function updateNote(
  noteId: number,
  data: Partial<Omit<InsertNote, "id" | "userId">>
) {
  await db
    .update(notes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(notes.id, noteId));
}

export async function deleteNote(noteId: number) {
  await db.delete(notes).where(eq(notes.id, noteId));
}
