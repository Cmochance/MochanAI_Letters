import { eq, desc, and, sql, inArray, isNull } from "drizzle-orm";
import { db } from "./index.js";
import {
  users,
  novels,
  chapters,
  chapterEmbeddings,
  userSettings,
  notes,
  noteEmbeddings,
  aiPlanDocuments,
  aiPlanVersions,
  aiExpandJobs,
  papers,
  paperSections,
  paperSectionEmbeddings,
  paperNotes,
  paperNoteEmbeddings,
  type InsertUser,
  type InsertNovel,
  type InsertChapter,
  type InsertChapterEmbedding,
  type InsertUserSettings,
  type InsertNote,
  type InsertNoteEmbedding,
  type InsertAIExpandJob,
  type InsertPaper,
  type InsertPaperSection,
  type InsertPaperSectionEmbedding,
  type InsertPaperNote,
  type InsertPaperNoteEmbedding,
  workspaceType,
  expandJobStatus,
  noteCategory,
  paperNoteCategory,
} from "./schema.js";

export type WorkspaceTypeValue = (typeof workspaceType.enumValues)[number];
export type ExpandJobStatusValue = (typeof expandJobStatus.enumValues)[number];
export type NoteCategoryValue = (typeof noteCategory.enumValues)[number];
export type PaperNoteCategoryValue =
  (typeof paperNoteCategory.enumValues)[number];

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

export async function searchSimilarChunks(
  novelId: number,
  queryEmbedding: number[],
  limit: number = 10
) {
  const vectorString = `[${queryEmbedding.join(",")}]`;

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

  return result.map((row) => ({
    id: Number(row.id),
    chapter_id: Number(row.chapter_id),
    novel_id: Number(row.novel_id),
    content_chunk: String(row.content_chunk ?? ""),
    chunk_index: Number(row.chunk_index),
    similarity: Number(row.similarity),
  }));
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
  category: NoteCategoryValue
) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.category, category)))
    .orderBy(desc(notes.updatedAt));
}

export async function getUserNovelNotes(userId: number, novelId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.novelId, novelId)))
    .orderBy(desc(notes.updatedAt));
}

export async function getUserUnboundNotes(userId: number) {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), isNull(notes.novelId)))
    .orderBy(desc(notes.updatedAt));
}

export async function getNovelNotes(novelId: number) {
  return db
    .select()
    .from(notes)
    .where(eq(notes.novelId, novelId))
    .orderBy(desc(notes.updatedAt));
}

export async function getNovelNotesByCategory(
  novelId: number,
  category: NoteCategoryValue,
  limit?: number
) {
  const query = db
    .select()
    .from(notes)
    .where(and(eq(notes.novelId, novelId), eq(notes.category, category)))
    .orderBy(desc(notes.updatedAt));

  if (limit && limit > 0) {
    return query.limit(limit);
  }

  return query;
}

export async function getUserNoteById(userId: number, noteId: number) {
  const result = await db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.id, noteId)))
    .limit(1);
  return result[0] || null;
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

// ============ Novel Note Embeddings ============

export async function deleteNoteEmbeddings(noteId: number) {
  await db.delete(noteEmbeddings).where(eq(noteEmbeddings.noteId, noteId));
}

export async function deleteNovelNoteEmbeddings(novelId: number) {
  await db.delete(noteEmbeddings).where(eq(noteEmbeddings.novelId, novelId));
}

export async function createNoteEmbeddingsBatch(
  data: Array<Omit<InsertNoteEmbedding, "id">>
) {
  if (data.length === 0) return [];
  const result = await db
    .insert(noteEmbeddings)
    .values(data)
    .returning({ id: noteEmbeddings.id });
  return result.map((r) => r.id);
}

export async function getNovelNoteEmbeddingCount(
  novelId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(noteEmbeddings)
    .where(eq(noteEmbeddings.novelId, novelId));
  return Number(result[0]?.count) || 0;
}

export async function searchSimilarNoteChunks(
  novelId: number,
  queryEmbedding: number[],
  limit: number = 8
) {
  const vectorString = `[${queryEmbedding.join(",")}]`;

  const result = await db.execute(sql`
    SELECT
      id,
      note_id,
      novel_id,
      category,
      content_chunk,
      chunk_index,
      1 - (embedding <=> ${vectorString}::vector) as similarity
    FROM note_embeddings
    WHERE novel_id = ${novelId}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `);

  return result.map((row) => ({
    id: Number(row.id),
    note_id: Number(row.note_id),
    novel_id: Number(row.novel_id),
    category: String(row.category ?? "inspiration") as NoteCategoryValue,
    content_chunk: String(row.content_chunk ?? ""),
    chunk_index: Number(row.chunk_index),
    similarity: Number(row.similarity),
  }));
}

// ============ Persisted Plans ============

export async function getPlanDocumentByScope(
  userId: number,
  workspace: WorkspaceTypeValue,
  workspaceId: number,
  sectionNumber: number
) {
  const result = await db
    .select()
    .from(aiPlanDocuments)
    .where(
      and(
        eq(aiPlanDocuments.userId, userId),
        eq(aiPlanDocuments.workspaceType, workspace),
        eq(aiPlanDocuments.workspaceId, workspaceId),
        eq(aiPlanDocuments.sectionNumber, sectionNumber)
      )
    )
    .limit(1);
  return result[0] || null;
}

export async function getPlanDocumentById(userId: number, documentId: number) {
  const result = await db
    .select()
    .from(aiPlanDocuments)
    .where(
      and(eq(aiPlanDocuments.id, documentId), eq(aiPlanDocuments.userId, userId))
    )
    .limit(1);

  return result[0] || null;
}

export async function getOrCreatePlanDocument(
  userId: number,
  workspace: WorkspaceTypeValue,
  workspaceId: number,
  sectionNumber: number
) {
  const existing = await getPlanDocumentByScope(
    userId,
    workspace,
    workspaceId,
    sectionNumber
  );

  if (existing) {
    return existing;
  }
  try {
    const inserted = await db
      .insert(aiPlanDocuments)
      .values({
        userId,
        workspaceType: workspace,
        workspaceId,
        sectionNumber,
      })
      .returning();

    return inserted[0];
  } catch (error) {
    const retry = await getPlanDocumentByScope(
      userId,
      workspace,
      workspaceId,
      sectionNumber
    );
    if (retry) return retry;
    throw error;
  }
}

export async function getLatestPlanVersion(documentId: number) {
  const result = await db
    .select()
    .from(aiPlanVersions)
    .where(eq(aiPlanVersions.documentId, documentId))
    .orderBy(desc(aiPlanVersions.version))
    .limit(1);

  return result[0] || null;
}

export async function createPlanVersion(
  userId: number,
  workspace: WorkspaceTypeValue,
  workspaceId: number,
  sectionNumber: number,
  outline: {
    theme: string;
    framework: string;
    conflicts: string;
    interactions: string;
  }
) {
  const document = await getOrCreatePlanDocument(
    userId,
    workspace,
    workspaceId,
    sectionNumber
  );

  const latest = await getLatestPlanVersion(document.id);
  const nextVersion = (latest?.version || 0) + 1;

  const inserted = await db
    .insert(aiPlanVersions)
    .values({
      documentId: document.id,
      version: nextVersion,
      theme: outline.theme,
      framework: outline.framework,
      conflicts: outline.conflicts,
      interactions: outline.interactions,
    })
    .returning();

  await db
    .update(aiPlanDocuments)
    .set({ updatedAt: new Date() })
    .where(eq(aiPlanDocuments.id, document.id));

  return {
    document,
    version: inserted[0],
  };
}

export async function createPlanVersionForDocument(
  documentId: number,
  outline: {
    theme: string;
    framework: string;
    conflicts: string;
    interactions: string;
  }
) {
  const latest = await getLatestPlanVersion(documentId);
  const nextVersion = (latest?.version || 0) + 1;

  const inserted = await db
    .insert(aiPlanVersions)
    .values({
      documentId,
      version: nextVersion,
      theme: outline.theme,
      framework: outline.framework,
      conflicts: outline.conflicts,
      interactions: outline.interactions,
    })
    .returning();

  await db
    .update(aiPlanDocuments)
    .set({ updatedAt: new Date() })
    .where(eq(aiPlanDocuments.id, documentId));

  return inserted[0];
}

export async function getLatestPlanByScope(
  userId: number,
  workspace: WorkspaceTypeValue,
  workspaceId: number,
  sectionNumber: number
) {
  const document = await getPlanDocumentByScope(
    userId,
    workspace,
    workspaceId,
    sectionNumber
  );

  if (!document) return null;

  const latestVersion = await getLatestPlanVersion(document.id);
  if (!latestVersion) return null;

  return {
    document,
    version: latestVersion,
  };
}

export async function listPlanVersions(documentId: number) {
  return db
    .select()
    .from(aiPlanVersions)
    .where(eq(aiPlanVersions.documentId, documentId))
    .orderBy(desc(aiPlanVersions.version));
}

export async function getPlanVersion(documentId: number, version: number) {
  const result = await db
    .select()
    .from(aiPlanVersions)
    .where(
      and(
        eq(aiPlanVersions.documentId, documentId),
        eq(aiPlanVersions.version, version)
      )
    )
    .limit(1);

  return result[0] || null;
}

// ============ Async Expand Jobs ============

export async function createExpandJob(
  data: Omit<InsertAIExpandJob, "id" | "createdAt" | "updatedAt"> & {
    status?: ExpandJobStatusValue;
  }
) {
  const inserted = await db
    .insert(aiExpandJobs)
    .values({
      ...data,
      status: data.status || "pending",
    })
    .returning();

  return inserted[0];
}

export async function getExpandJobById(userId: number, jobId: number) {
  const result = await db
    .select()
    .from(aiExpandJobs)
    .where(and(eq(aiExpandJobs.id, jobId), eq(aiExpandJobs.userId, userId)))
    .limit(1);

  return result[0] || null;
}

export async function getExpandJobsByWorkspace(
  userId: number,
  workspaceTypeValue: WorkspaceTypeValue,
  workspaceId: number,
  limit: number = 10
) {
  return db
    .select()
    .from(aiExpandJobs)
    .where(
      and(
        eq(aiExpandJobs.userId, userId),
        eq(aiExpandJobs.workspaceType, workspaceTypeValue),
        eq(aiExpandJobs.workspaceId, workspaceId)
      )
    )
    .orderBy(desc(aiExpandJobs.createdAt))
    .limit(limit);
}

export async function updateExpandJob(
  jobId: number,
  userId: number,
  data: Partial<
    Pick<
      InsertAIExpandJob,
      "status" | "resultContent" | "errorMessage" | "startedAt" | "finishedAt"
    >
  >
) {
  await db
    .update(aiExpandJobs)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(aiExpandJobs.id, jobId), eq(aiExpandJobs.userId, userId)));
}

export async function getPendingExpandJobs(limit: number = 20) {
  return db
    .select()
    .from(aiExpandJobs)
    .where(eq(aiExpandJobs.status, "pending"))
    .orderBy(aiExpandJobs.createdAt)
    .limit(limit);
}

// ============ Papers ============

export async function getUserPapers(userId: number) {
  return db
    .select()
    .from(papers)
    .where(eq(papers.userId, userId))
    .orderBy(desc(papers.updatedAt));
}

export async function getPaperById(paperId: number) {
  const result = await db
    .select()
    .from(papers)
    .where(eq(papers.id, paperId))
    .limit(1);
  return result[0] || null;
}

export async function createPaper(data: Omit<InsertPaper, "id">) {
  const result = await db
    .insert(papers)
    .values(data)
    .returning({ id: papers.id });
  return result[0].id;
}

export async function updatePaper(
  paperId: number,
  data: Partial<Omit<InsertPaper, "id" | "userId">>
) {
  await db
    .update(papers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(papers.id, paperId));
}

export async function deletePaper(paperId: number) {
  await db.delete(papers).where(eq(papers.id, paperId));
}

export async function updatePaperWordCount(paperId: number) {
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${paperSections.wordCount}), 0)` })
    .from(paperSections)
    .where(eq(paperSections.paperId, paperId));

  const totalWords = Number(result[0]?.total) || 0;

  await db
    .update(papers)
    .set({ totalWords, updatedAt: new Date() })
    .where(eq(papers.id, paperId));
}

// ============ Paper Sections ============

export async function getPaperSections(paperId: number) {
  return db
    .select()
    .from(paperSections)
    .where(eq(paperSections.paperId, paperId))
    .orderBy(paperSections.sectionNumber);
}

export async function getPaperSectionById(sectionId: number) {
  const result = await db
    .select()
    .from(paperSections)
    .where(eq(paperSections.id, sectionId))
    .limit(1);

  return result[0] || null;
}

export async function getRecentPaperSections(paperId: number, limit: number = 2) {
  return db
    .select()
    .from(paperSections)
    .where(eq(paperSections.paperId, paperId))
    .orderBy(desc(paperSections.sectionNumber))
    .limit(limit);
}

export async function createPaperSection(data: Omit<InsertPaperSection, "id">) {
  const result = await db
    .insert(paperSections)
    .values(data)
    .returning({ id: paperSections.id });

  await updatePaperWordCount(data.paperId);

  return result[0].id;
}

export async function updatePaperSection(
  sectionId: number,
  data: Partial<Omit<InsertPaperSection, "id" | "paperId">>
) {
  const existing = await getPaperSectionById(sectionId);
  if (!existing) return;

  await db
    .update(paperSections)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paperSections.id, sectionId));

  if (data.wordCount !== undefined) {
    await updatePaperWordCount(existing.paperId);
  }
}

export async function deletePaperSection(sectionId: number) {
  const existing = await getPaperSectionById(sectionId);
  if (!existing) return;

  await db.delete(paperSections).where(eq(paperSections.id, sectionId));
  await updatePaperWordCount(existing.paperId);
}

// ============ Paper Section Embeddings ============

export async function deletePaperSectionEmbeddings(sectionId: number) {
  await db
    .delete(paperSectionEmbeddings)
    .where(eq(paperSectionEmbeddings.sectionId, sectionId));
}

export async function createPaperSectionEmbeddingsBatch(
  data: Array<Omit<InsertPaperSectionEmbedding, "id">>
) {
  if (data.length === 0) return [];

  const result = await db
    .insert(paperSectionEmbeddings)
    .values(data)
    .returning({ id: paperSectionEmbeddings.id });

  return result.map((r) => r.id);
}

export async function getPaperSectionEmbeddingCount(
  paperId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(paperSectionEmbeddings)
    .where(eq(paperSectionEmbeddings.paperId, paperId));

  return Number(result[0]?.count) || 0;
}

export async function searchSimilarPaperSectionChunks(
  paperId: number,
  queryEmbedding: number[],
  limit: number = 8
) {
  const vectorString = `[${queryEmbedding.join(",")}]`;

  const result = await db.execute(sql`
    SELECT
      id,
      section_id,
      paper_id,
      content_chunk,
      chunk_index,
      1 - (embedding <=> ${vectorString}::vector) as similarity
    FROM paper_section_embeddings
    WHERE paper_id = ${paperId}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `);

  return result.map((row) => ({
    id: Number(row.id),
    section_id: Number(row.section_id),
    paper_id: Number(row.paper_id),
    content_chunk: String(row.content_chunk ?? ""),
    chunk_index: Number(row.chunk_index),
    similarity: Number(row.similarity),
  }));
}

// ============ Paper Notes ============

export async function getPaperNotes(paperId: number) {
  return db
    .select()
    .from(paperNotes)
    .where(eq(paperNotes.paperId, paperId))
    .orderBy(desc(paperNotes.updatedAt));
}

export async function getPaperNotesByCategory(
  paperId: number,
  category: PaperNoteCategoryValue,
  limit?: number
) {
  const query = db
    .select()
    .from(paperNotes)
    .where(and(eq(paperNotes.paperId, paperId), eq(paperNotes.category, category)))
    .orderBy(desc(paperNotes.updatedAt));

  if (limit && limit > 0) {
    return query.limit(limit);
  }

  return query;
}

export async function getPaperNoteById(userId: number, noteId: number) {
  const result = await db
    .select()
    .from(paperNotes)
    .where(and(eq(paperNotes.id, noteId), eq(paperNotes.userId, userId)))
    .limit(1);

  return result[0] || null;
}

export async function getPaperNoteByIdUnsafe(noteId: number) {
  const result = await db
    .select()
    .from(paperNotes)
    .where(eq(paperNotes.id, noteId))
    .limit(1);

  return result[0] || null;
}

export async function createPaperNote(data: Omit<InsertPaperNote, "id">) {
  const result = await db
    .insert(paperNotes)
    .values(data)
    .returning({ id: paperNotes.id });

  return result[0].id;
}

export async function updatePaperNote(
  noteId: number,
  data: Partial<Omit<InsertPaperNote, "id" | "userId">>
) {
  await db
    .update(paperNotes)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(paperNotes.id, noteId));
}

export async function deletePaperNote(noteId: number) {
  await db.delete(paperNotes).where(eq(paperNotes.id, noteId));
}

// ============ Paper Note Embeddings ============

export async function deletePaperNoteEmbeddings(noteId: number) {
  await db
    .delete(paperNoteEmbeddings)
    .where(eq(paperNoteEmbeddings.noteId, noteId));
}

export async function createPaperNoteEmbeddingsBatch(
  data: Array<Omit<InsertPaperNoteEmbedding, "id">>
) {
  if (data.length === 0) return [];

  const result = await db
    .insert(paperNoteEmbeddings)
    .values(data)
    .returning({ id: paperNoteEmbeddings.id });

  return result.map((r) => r.id);
}

export async function getPaperNoteEmbeddingCount(
  paperId: number
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(paperNoteEmbeddings)
    .where(eq(paperNoteEmbeddings.paperId, paperId));

  return Number(result[0]?.count) || 0;
}

export async function searchSimilarPaperNoteChunks(
  paperId: number,
  queryEmbedding: number[],
  limit: number = 8
) {
  const vectorString = `[${queryEmbedding.join(",")}]`;

  const result = await db.execute(sql`
    SELECT
      id,
      note_id,
      paper_id,
      category,
      content_chunk,
      chunk_index,
      1 - (embedding <=> ${vectorString}::vector) as similarity
    FROM paper_note_embeddings
    WHERE paper_id = ${paperId}
    ORDER BY embedding <=> ${vectorString}::vector
    LIMIT ${limit}
  `);

  return result.map((row) => ({
    id: Number(row.id),
    note_id: Number(row.note_id),
    paper_id: Number(row.paper_id),
    category: String(row.category ?? "research_question") as PaperNoteCategoryValue,
    content_chunk: String(row.content_chunk ?? ""),
    chunk_index: Number(row.chunk_index),
    similarity: Number(row.similarity),
  }));
}

// ============ Utility ============

export async function getNotesByIds(noteIds: number[]) {
  if (noteIds.length === 0) return [];
  return db.select().from(notes).where(inArray(notes.id, noteIds));
}

export async function getPaperNotesByIds(noteIds: number[]) {
  if (noteIds.length === 0) return [];
  return db.select().from(paperNotes).where(inArray(paperNotes.id, noteIds));
}
