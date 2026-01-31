import {
  customType,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Custom vector type for pgvector extension
 * Stores 1536-dimensional vectors (matching text-embedding-3-small)
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    // Handle PostgreSQL vector format: [0.1,0.2,0.3,...]
    const cleaned = value.replace(/^\[|\]$/g, "");
    return cleaned.split(",").map((s) => parseFloat(s.trim()));
  },
});

/**
 * User role enum
 */
export const userRole = pgEnum("role", ["user", "admin"]);

/**
 * Users table - linked to Supabase Auth
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Supabase Auth user ID */
  supabaseId: uuid("supabase_id").notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Novels table - stores novel metadata
 */
export const novels = pgTable("novels", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverUrl: varchar("cover_url", { length: 500 }),
  totalWords: integer("total_words").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Novel = typeof novels.$inferSelect;
export type InsertNovel = typeof novels.$inferInsert;

/**
 * Chapters table - stores chapter content
 */
export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  novelId: integer("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  chapterNumber: integer("chapter_number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  wordCount: integer("word_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Chapter = typeof chapters.$inferSelect;
export type InsertChapter = typeof chapters.$inferInsert;

/**
 * Chapter embeddings table - stores vector embeddings for RAG
 * Uses pgvector extension for efficient similarity search
 */
export const chapterEmbeddings = pgTable("chapter_embeddings", {
  id: serial("id").primaryKey(),
  chapterId: integer("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  novelId: integer("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  /** The text chunk that was embedded */
  contentChunk: text("content_chunk").notNull(),
  /** Vector embedding (1536 dimensions for text-embedding-3-small) */
  embedding: vector("embedding").notNull(),
  /** Chunk index within the chapter */
  chunkIndex: integer("chunk_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChapterEmbedding = typeof chapterEmbeddings.$inferSelect;
export type InsertChapterEmbedding = typeof chapterEmbeddings.$inferInsert;

/**
 * User settings table - stores AI configuration
 */
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Chat completion API key */
  apiKey: text("api_key"),
  apiBaseUrl: varchar("api_base_url", { length: 500 }),
  modelName: varchar("model_name", { length: 100 }),
  /** User's preferred writing style description */
  writingStyle: text("writing_style"),
  /** Embedding API key (optional, uses built-in if not set) */
  embeddingApiKey: text("embedding_api_key"),
  embeddingBaseUrl: varchar("embedding_base_url", { length: 500 }),
  embeddingModel: varchar("embedding_model", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Note category enum
 */
export const noteCategory = pgEnum("note_category", [
  "inspiration",
  "character",
  "worldview",
  "plot",
  "other",
]);

/**
 * Notes table - stores inspiration notes
 */
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  novelId: integer("novel_id").references(() => novels.id, {
    onDelete: "set null",
  }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: noteCategory("category").default("inspiration").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;
