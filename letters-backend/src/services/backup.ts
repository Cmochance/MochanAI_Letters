import * as db from "../db/queries.js";

interface BackupData {
  novels: Array<{
    id: number;
    title: string;
    description: string | null;
    coverUrl: string | null;
    totalWords: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  chapters: Array<{
    id: number;
    novelId: number;
    chapterNumber: number;
    title: string;
    content: string;
    wordCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

/**
 * Export all user data for backup
 */
export async function exportUserData(userId: number): Promise<BackupData> {
  const novels = await db.getUserNovels(userId);

  const allChapters: BackupData["chapters"] = [];
  for (const novel of novels) {
    const chapters = await db.getNovelChapters(novel.id);
    allChapters.push(...chapters);
  }

  return {
    novels: novels.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      coverUrl: n.coverUrl,
      totalWords: n.totalWords,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    chapters: allChapters.map((c) => ({
      id: c.id,
      novelId: c.novelId,
      chapterNumber: c.chapterNumber,
      title: c.title,
      content: c.content,
      wordCount: c.wordCount,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  };
}

/**
 * Import user data from backup
 */
export async function importUserData(
  userId: number,
  data: { novels: unknown[]; chapters: unknown[] }
): Promise<{ novelsImported: number; chaptersImported: number }> {
  let novelsImported = 0;
  let chaptersImported = 0;

  // Map old novel IDs to new IDs
  const novelIdMap = new Map<number, number>();

  // Import novels
  for (const novelData of data.novels as Array<{
    id: number;
    title: string;
    description?: string;
  }>) {
    const newNovelId = await db.createNovel({
      userId,
      title: novelData.title,
      description: novelData.description,
    });
    novelIdMap.set(novelData.id, newNovelId);
    novelsImported++;
  }

  // Import chapters
  for (const chapterData of data.chapters as Array<{
    novelId: number;
    chapterNumber: number;
    title: string;
    content: string;
    wordCount: number;
  }>) {
    const newNovelId = novelIdMap.get(chapterData.novelId);
    if (!newNovelId) continue;

    await db.createChapter({
      novelId: newNovelId,
      chapterNumber: chapterData.chapterNumber,
      title: chapterData.title,
      content: chapterData.content,
      wordCount: chapterData.wordCount,
    });
    chaptersImported++;
  }

  return { novelsImported, chaptersImported };
}
