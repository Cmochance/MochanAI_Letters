import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users, 
  novels, 
  chapters, 
  chapterEmbeddings, 
  userSettings,
  InsertNovel,
  InsertChapter,
  InsertChapterEmbedding,
  InsertUserSettings,
  Novel,
  Chapter,
  ChapterEmbedding,
  UserSettings
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ============ Novel Management ============

export async function getUserNovels(userId: number): Promise<Novel[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(novels).where(eq(novels.userId, userId)).orderBy(desc(novels.updatedAt));
}

export async function getNovelById(novelId: number): Promise<Novel | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(novels).where(eq(novels.id, novelId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createNovel(data: InsertNovel): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result: any = await db.insert(novels).values(data);
  return Number(result.insertId);
}

export async function updateNovel(novelId: number, data: Partial<InsertNovel>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(novels).set(data).where(eq(novels.id, novelId));
}

export async function deleteNovel(novelId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Delete related chapters and embeddings first
  await db.delete(chapterEmbeddings).where(eq(chapterEmbeddings.novelId, novelId));
  await db.delete(chapters).where(eq(chapters.novelId, novelId));
  await db.delete(novels).where(eq(novels.id, novelId));
}

// ============ Chapter Management ============

export async function getNovelChapters(novelId: number): Promise<Chapter[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(chapters).where(eq(chapters.novelId, novelId)).orderBy(chapters.chapterNumber);
}

export async function getChapterById(chapterId: number): Promise<Chapter | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getRecentChapters(novelId: number, limit: number = 3): Promise<Chapter[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(chapters)
    .where(eq(chapters.novelId, novelId))
    .orderBy(desc(chapters.chapterNumber))
    .limit(limit);
}

export async function createChapter(data: InsertChapter): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result: any = await db.insert(chapters).values(data);
  
  // Update novel's total words
  const novel = await getNovelById(data.novelId);
  if (novel) {
    await updateNovel(data.novelId, {
      totalWords: novel.totalWords + (data.wordCount || 0),
      updatedAt: new Date(),
    });
  }
  
  return Number(result.insertId);
}

export async function updateChapter(chapterId: number, data: Partial<InsertChapter>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get old chapter to calculate word count difference
  const oldChapter = await getChapterById(chapterId);
  
  await db.update(chapters).set(data).where(eq(chapters.id, chapterId));
  
  // Update novel's total words if word count changed
  if (oldChapter && data.wordCount !== undefined && data.wordCount !== null) {
    const novel = await getNovelById(oldChapter.novelId);
    if (novel) {
      const wordDiff = data.wordCount - oldChapter.wordCount;
      await updateNovel(oldChapter.novelId, {
        totalWords: novel.totalWords + wordDiff,
        updatedAt: new Date(),
      });
    }
  }
}

export async function deleteChapter(chapterId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const chapter = await getChapterById(chapterId);
  if (!chapter) return;
  
  // Delete related embeddings
  await db.delete(chapterEmbeddings).where(eq(chapterEmbeddings.chapterId, chapterId));
  await db.delete(chapters).where(eq(chapters.id, chapterId));
  
  // Update novel's total words
  const novel = await getNovelById(chapter.novelId);
  if (novel) {
    await updateNovel(chapter.novelId, {
      totalWords: Math.max(0, novel.totalWords - chapter.wordCount),
      updatedAt: new Date(),
    });
  }
}

// ============ Embedding Management ============

export async function saveChapterEmbeddings(embeddings: InsertChapterEmbedding[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  if (embeddings.length === 0) return;
  
  await db.insert(chapterEmbeddings).values(embeddings);
}

export async function getNovelEmbeddings(novelId: number): Promise<ChapterEmbedding[]> {
  const db = await getDb();
  if (!db) return [];
  
  return db.select().from(chapterEmbeddings).where(eq(chapterEmbeddings.novelId, novelId));
}

export async function deleteChapterEmbeddings(chapterId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.delete(chapterEmbeddings).where(eq(chapterEmbeddings.chapterId, chapterId));
}

// ============ User Settings Management ============

export async function getUserSettings(userId: number): Promise<UserSettings | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserSettings(data: InsertUserSettings): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await getUserSettings(data.userId);
  
  if (existing) {
    await db.update(userSettings).set(data).where(eq(userSettings.userId, data.userId));
  } else {
    await db.insert(userSettings).values(data);
  }
}
