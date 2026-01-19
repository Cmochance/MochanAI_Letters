import { integer, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const userRole = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: serial("id").primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const userCredentials = pgTable("user_credentials", {
  userId: integer("userId").primaryKey().notNull(),
  algorithm: varchar("algorithm", { length: 32 }).notNull(),
  salt: text("salt").notNull(),
  passwordHash: text("passwordHash").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserCredentials = typeof userCredentials.$inferSelect;
export type InsertUserCredentials = typeof userCredentials.$inferInsert;

/**
 * Novels table - stores novel metadata
 */
export const novels = pgTable("novels", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverUrl: varchar("coverUrl", { length: 500 }),
  totalWords: integer("totalWords").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Novel = typeof novels.$inferSelect;
export type InsertNovel = typeof novels.$inferInsert;

/**
 * Chapters table - stores chapter content
 */
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  novelId: integer("novelId").notNull(),
  chapterNumber: integer("chapterNumber").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  wordCount: integer("wordCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = typeof chapters.$inferInsert;

/**
 * Chapter embeddings table - stores vector embeddings for RAG
 * Note: we store embeddings as JSON text (array of floats) and handle vector operations in application code.
 * If you want native vector search, consider enabling pgvector and changing this column type accordingly.
 */
export const chapterEmbeddings = pgTable("chapter_embeddings", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapterId").notNull(),
  novelId: integer("novelId").notNull(),
  contentChunk: text("contentChunk").notNull(),
  // Store embedding as JSON string (array of floats)
  embedding: text("embedding").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChapterEmbedding = typeof chapterEmbeddings.$inferSelect;
export type InsertChapterEmbedding = typeof chapterEmbeddings.$inferInsert;

/**
 * User settings table - stores AI configuration
 */
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().unique(),
  // Encrypted API key
  apiKey: text("apiKey"),
  apiBaseUrl: varchar("apiBaseUrl", { length: 500 }),
  modelName: varchar("modelName", { length: 100 }),
  writingStyle: text("writingStyle"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Notes table - stores inspiration notes
 */
export const noteCategory = pgEnum("note_category", [
  "inspiration",
  "character",
  "worldview",
  "plot",
  "other",
]);

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  novelId: integer("novelId"), // Optional: link to a specific novel
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: noteCategory("category").default("inspiration").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;
