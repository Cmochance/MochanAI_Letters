import * as db from "../db";

/**
 * Export all user data as JSON backup
 */
export async function exportUserData(userId: number): Promise<{
  novels: any[];
  chapters: any[];
  exportDate: string;
  version: string;
}> {
  // Get all novels for the user
  const novels = await db.getUserNovels(userId);
  
  // Get all chapters for each novel
  const allChapters: any[] = [];
  for (const novel of novels) {
    const chapters = await db.getNovelChapters(novel.id);
    allChapters.push(...chapters);
  }

  return {
    novels,
    chapters: allChapters,
    exportDate: new Date().toISOString(),
    version: "1.0",
  };
}

/**
 * Import user data from JSON backup
 */
export async function importUserData(
  userId: number,
  data: {
    novels: any[];
    chapters: any[];
  }
): Promise<{ imported: { novels: number; chapters: number } }> {
  let novelsImported = 0;
  let chaptersImported = 0;

  // Import novels
  for (const novel of data.novels) {
    try {
      const novelId = await db.createNovel({
        userId,
        title: novel.title,
        description: novel.description,
        coverUrl: novel.coverUrl,
      });

      novelsImported++;

      // Import chapters for this novel
      const novelChapters = data.chapters.filter(
        (ch) => ch.novelId === novel.id
      );

      for (const chapter of novelChapters) {
        try {
          await db.createChapter({
            novelId,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            content: chapter.content,
          });
          chaptersImported++;
        } catch (error) {
          console.error("Failed to import chapter:", error);
        }
      }
    } catch (error) {
      console.error("Failed to import novel:", error);
    }
  }

  return {
    imported: {
      novels: novelsImported,
      chapters: chaptersImported,
    },
  };
}
