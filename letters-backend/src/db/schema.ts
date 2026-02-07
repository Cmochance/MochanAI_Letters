import {
  customType,
  integer,
  pgEnum,
  pgTable,
  unique,
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

export const workspaceType = pgEnum("workspace_type", ["novel", "paper"]);
export const expandJobStatus = pgEnum("expand_job_status", [
  "pending",
  "running",
  "succeeded",
  "failed",
  "canceled",
]);
export const paperNoteCategory = pgEnum("paper_note_category", [
  "research_question",
  "literature_review",
  "methodology",
  "data_experiment",
  "result_analysis",
  "discussion_limitations",
  "citations_todo",
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

/**
 * Novel note embeddings for mixed-context retrieval
 */
export const noteEmbeddings = pgTable("note_embeddings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: integer("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  novelId: integer("novel_id")
    .notNull()
    .references(() => novels.id, { onDelete: "cascade" }),
  category: noteCategory("category").notNull(),
  contentChunk: text("content_chunk").notNull(),
  embedding: vector("embedding").notNull(),
  chunkIndex: integer("chunk_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type NoteEmbedding = typeof noteEmbeddings.$inferSelect;
export type InsertNoteEmbedding = typeof noteEmbeddings.$inferInsert;

/**
 * Persisted AI outline documents and version history
 */
export const aiPlanDocuments = pgTable(
  "ai_plan_documents",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceType: workspaceType("workspace_type").notNull(),
    workspaceId: integer("workspace_id").notNull(),
    chapterId: integer("chapter_id").references(() => chapters.id, {
      onDelete: "set null",
    }),
    sectionNumber: integer("section_number").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userWorkspaceSectionUnique: unique("ai_plan_documents_scope_unique").on(
      table.userId,
      table.workspaceType,
      table.workspaceId,
      table.sectionNumber
    ),
  })
);

export type AIPlanDocument = typeof aiPlanDocuments.$inferSelect;
export type InsertAIPlanDocument = typeof aiPlanDocuments.$inferInsert;

export const aiPlanVersions = pgTable(
  "ai_plan_versions",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => aiPlanDocuments.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    theme: text("theme").notNull(),
    framework: text("framework").notNull(),
    conflicts: text("conflicts").notNull(),
    interactions: text("interactions").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    documentVersionUnique: unique("ai_plan_versions_unique").on(
      table.documentId,
      table.version
    ),
  })
);

export type AIPlanVersion = typeof aiPlanVersions.$inferSelect;
export type InsertAIPlanVersion = typeof aiPlanVersions.$inferInsert;

/**
 * Async expansion jobs (novel + paper)
 */
export const aiExpandJobs = pgTable("ai_expand_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  workspaceType: workspaceType("workspace_type").notNull(),
  workspaceId: integer("workspace_id").notNull(),
  chapterId: integer("chapter_id").references(() => chapters.id, {
    onDelete: "set null",
  }),
  outline: text("outline").notNull(),
  targetWords: integer("target_words").default(4000).notNull(),
  planDocumentId: integer("plan_document_id").references(() => aiPlanDocuments.id, {
    onDelete: "set null",
  }),
  status: expandJobStatus("status").default("pending").notNull(),
  resultContent: text("result_content"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type AIExpandJob = typeof aiExpandJobs.$inferSelect;
export type InsertAIExpandJob = typeof aiExpandJobs.$inferInsert;

/**
 * Papers domain (parallel to novels)
 */
export const papers = pgTable("papers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  totalWords: integer("total_words").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Paper = typeof papers.$inferSelect;
export type InsertPaper = typeof papers.$inferInsert;

export const paperSections = pgTable("paper_sections", {
  id: serial("id").primaryKey(),
  paperId: integer("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),
  sectionNumber: integer("section_number").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  wordCount: integer("word_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaperSection = typeof paperSections.$inferSelect;
export type InsertPaperSection = typeof paperSections.$inferInsert;

export const paperSectionEmbeddings = pgTable("paper_section_embeddings", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id")
    .notNull()
    .references(() => paperSections.id, { onDelete: "cascade" }),
  paperId: integer("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),
  contentChunk: text("content_chunk").notNull(),
  embedding: vector("embedding").notNull(),
  chunkIndex: integer("chunk_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaperSectionEmbedding = typeof paperSectionEmbeddings.$inferSelect;
export type InsertPaperSectionEmbedding =
  typeof paperSectionEmbeddings.$inferInsert;

export const paperNotes = pgTable("paper_notes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  paperId: integer("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  category: paperNoteCategory("category").default("research_question").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PaperNote = typeof paperNotes.$inferSelect;
export type InsertPaperNote = typeof paperNotes.$inferInsert;

export const paperNoteEmbeddings = pgTable("paper_note_embeddings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  noteId: integer("note_id")
    .notNull()
    .references(() => paperNotes.id, { onDelete: "cascade" }),
  paperId: integer("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),
  category: paperNoteCategory("category").notNull(),
  contentChunk: text("content_chunk").notNull(),
  embedding: vector("embedding").notNull(),
  chunkIndex: integer("chunk_index").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PaperNoteEmbedding = typeof paperNoteEmbeddings.$inferSelect;
export type InsertPaperNoteEmbedding = typeof paperNoteEmbeddings.$inferInsert;
