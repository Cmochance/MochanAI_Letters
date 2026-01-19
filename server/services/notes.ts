import * as db from "../db";
import { Note } from "../../drizzle/schema";

export type NoteCategory = "inspiration" | "character" | "worldview" | "plot" | "other";

/**
 * Create a new note
 */
export async function createNote(
  userId: number,
  title: string,
  content: string,
  category: NoteCategory,
  novelId?: number
): Promise<Note> {
  return db.createNote(userId, title, content, category, novelId);
}

/**
 * Get all notes for a user
 */
export async function getUserNotes(userId: number): Promise<Note[]> {
  return db.getUserNotes(userId);
}

/**
 * Get notes by category
 */
export async function getNotesByCategory(userId: number, category: NoteCategory): Promise<Note[]> {
  return db.getNotesByCategory(userId, category);
}

/**
 * Get notes linked to a novel
 */
export async function getNovelNotes(novelId: number): Promise<Note[]> {
  return db.getNovelNotes(novelId);
}

/**
 * Get a single note by ID
 */
export async function getNoteById(noteId: number): Promise<Note | null> {
  const note = await db.getNoteById(noteId);
  return note || null;
}

/**
 * Update a note
 */
export async function updateNote(
  noteId: number,
  title: string,
  content: string,
  category: NoteCategory,
  novelId?: number | null
): Promise<void> {
  return db.updateNote(noteId, title, content, category, novelId);
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: number): Promise<void> {
  return db.deleteNote(noteId);
}

/**
 * Get category display name
 */
export function getCategoryName(category: NoteCategory): string {
  const names: Record<NoteCategory, string> = {
    inspiration: "💡 灵感",
    character: "👤 人物",
    worldview: "🌏 世界观",
    plot: "📖 情节",
    other: "📝 其他",
  };
  return names[category];
}
