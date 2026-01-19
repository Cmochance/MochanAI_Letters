import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Novels table - stores novel metadata
 */
export const novels = mysqlTable("novels", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverUrl: varchar("coverUrl", { length: 500 }),
  totalWords: int("totalWords").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Novel = typeof novels.$inferSelect;
export type InsertNovel = typeof novels.$inferInsert;

/**
 * Chapters table - stores chapter content
 */
export const chapters = mysqlTable("chapters", {
  id: int("id").autoincrement().primaryKey(),
  novelId: int("novelId").notNull(),
  chapterNumber: int("chapterNumber").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  wordCount: int("wordCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = typeof chapters.$inferInsert;

/**
 * Chapter embeddings table - stores vector embeddings for RAG
 * Note: MySQL doesn't support native vector types like PostgreSQL's pgvector
 * We'll store embeddings as JSON text and handle vector operations in application code
 */
export const chapterEmbeddings = mysqlTable("chapter_embeddings", {
  id: int("id").autoincrement().primaryKey(),
  chapterId: int("chapterId").notNull(),
  novelId: int("novelId").notNull(),
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
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  // Encrypted API key
  apiKey: text("apiKey"),
  apiBaseUrl: varchar("apiBaseUrl", { length: 500 }),
  modelName: varchar("modelName", { length: 100 }),
  writingStyle: text("writingStyle"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
