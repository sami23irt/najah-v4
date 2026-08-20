import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  vector,
  uuid,
} from "drizzle-orm/pg-core";

// ---- enums ----------------------------------------------------------------
export const schoolLevelEnum = pgEnum("school_level", ["3AC", "TRC", "1BAC", "2BAC"]);
export const roomKindEnum = pgEnum("room_kind", ["open", "private"]);
export const roomRoleEnum = pgEnum("room_role", ["host", "moderator", "member"]);
export const timerPhaseEnum = pgEnum("timer_phase", ["focus", "break", "paused"]);
export const examTypeEnum = pgEnum("exam_type", ["regional", "national", "school"]);
export const sessionEnum = pgEnum("exam_session", ["normal", "makeup"]);
export const fileKindEnum = pgEnum("file_kind", ["subject", "correction", "resource"]);
export const localeEnum = pgEnum("locale", ["ar", "fr"]);

// ---- users / profiles ------------------------------------------------------
// Note: auth itself is handled by Supabase Auth (auth.users). student_profiles
// mirrors the subset of profile data the app owns, keyed by the Supabase
// auth user id (uuid) — not by a separate app-managed integer id/table.
export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: serial("id").primaryKey(),
    // References auth.users(id) — enforced via Supabase migration SQL (see 0001_rag.sql)
    userId: uuid("user_id").notNull(),
    level: schoolLevelEnum("level"),
    track: varchar("track", { length: 120 }),
    region: varchar("region", { length: 120 }),
    institution: varchar("institution", { length: 160 }),
    pseudonym: varchar("pseudonym", { length: 50 }),
    showPseudonym: boolean("show_pseudonym").notNull().default(true),
    preferredLocale: localeEnum("preferred_locale").notNull().default("ar"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    userUnique: uniqueIndex("student_profiles_user_id_unique").on(table.userId),
    levelRegionIdx: index("student_profiles_level_region_idx").on(table.level, table.region),
  })
);

// ---- exam archive -----------------------------------------------------------
export const exams = pgTable(
  "exams",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    level: schoolLevelEnum("level").notNull(),
    track: varchar("track", { length: 120 }),
    subject: varchar("subject", { length: 120 }).notNull(),
    region: varchar("region", { length: 120 }),
    examType: examTypeEnum("exam_type").notNull(),
    session: sessionEnum("session").notNull(),
    year: integer("year").notNull(),
    curriculumReference: varchar("curriculum_reference", { length: 255 }),
    sourceUrl: varchar("source_url", { length: 500 }),
    isPublished: boolean("is_published").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    filterIdx: index("exams_filter_idx").on(table.level, table.subject, table.region, table.year),
    publicationIdx: index("exams_publication_idx").on(table.isPublished, table.year),
  })
);

export const examFiles = pgTable(
  "exam_files",
  {
    id: serial("id").primaryKey(),
    examId: integer("exam_id").notNull().references(() => exams.id, { onDelete: "cascade" }),
    kind: fileKindEnum("kind").notNull(),
    // Supabase Storage object path, e.g. "exams/2026/math-2bac-national.pdf"
    storagePath: varchar("storage_path", { length: 500 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull().default("application/pdf"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ examIdx: index("exam_files_exam_idx").on(table.examId, table.kind) })
);

// ---- study rooms (chat + pomodoro; A/V handled by LiveKit, not stored here) -
export const studyRooms = pgTable(
  "study_rooms",
  {
    id: serial("id").primaryKey(),
    ownerId: uuid("owner_id").notNull(),
    name: varchar("name", { length: 140 }).notNull(),
    description: text("description"),
    kind: roomKindEnum("kind").notNull(),
    level: schoolLevelEnum("level"),
    track: varchar("track", { length: 120 }),
    subject: varchar("subject", { length: 120 }),
    maxMembers: integer("max_members").notNull().default(12),
    accessCodeHash: varchar("access_code_hash", { length: 128 }),
    timerPhase: timerPhaseEnum("timer_phase").notNull().default("paused"),
    timerEndsAt: timestamp("timer_ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ directoryIdx: index("study_rooms_directory_idx").on(table.kind, table.level, table.subject) })
);

export const roomMembers = pgTable(
  "room_members",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull().references(() => studyRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    role: roomRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    roomUserUnique: uniqueIndex("room_members_room_user_unique").on(table.roomId, table.userId),
    userRoomIdx: index("room_members_user_room_idx").on(table.userId, table.roomId),
  })
);

export const roomMessages = pgTable(
  "room_messages",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull().references(() => studyRooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ roomDateIdx: index("room_messages_room_date_idx").on(table.roomId, table.createdAt) })
);

// ---- study tracking / gamification ------------------------------------------
export const studySessions = pgTable(
  "study_sessions",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    roomId: integer("room_id").references(() => studyRooms.id, { onDelete: "set null" }),
    subject: varchar("subject", { length: 120 }),
    durationMinutes: integer("duration_minutes").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ userDateIdx: index("study_sessions_user_date_idx").on(table.userId, table.startedAt) })
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    // Nullable: quizzes generated from a student's own uploaded document
    // (see studentDocuments below) don't have a curriculum level.
    level: schoolLevelEnum("level"),
    subject: varchar("subject", { length: 120 }).notNull(),
    documentId: uuid("document_id").references(() => studentDocuments.id, { onDelete: "set null" }),
    totalQuestions: integer("total_questions").notNull(),
    correctAnswers: integer("correct_answers").notNull(),
    curriculumReference: varchar("curriculum_reference", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ userSubjectIdx: index("quiz_attempts_user_subject_idx").on(table.userId, table.subject, table.createdAt) })
);

// quiz_sessions was previously only defined in raw SQL (0007_compliance_quizzes_whiteboard.sql)
// without a drizzle mirror. Added here for consistency with the rest of the schema.
export const quizSessions = pgTable(
  "quiz_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    level: schoolLevelEnum("level"),
    subject: varchar("subject", { length: 120 }).notNull(),
    documentId: uuid("document_id").references(() => studentDocuments.id, { onDelete: "cascade" }),
    questions: jsonb("questions").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    correctAnswers: integer("correct_answers"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  table => ({ userIdx: index("quiz_sessions_user_idx").on(table.userId, table.createdAt) })
);

// FIX (bug #1 from the audit): leaderboard_snapshots existed before but nothing
// ever wrote to it. It's now populated by lib/leaderboard.ts:refreshLeaderboard(),
// which is called after every recorded study session / quiz attempt and by a
// scheduled Supabase Edge Function (see supabase/migrations/0002_leaderboard_cron.sql).
export const leaderboardSnapshots = pgTable(
  "leaderboard_snapshots",
  {
    id: serial("id").primaryKey(),
    region: varchar("region", { length: 120 }),
    subject: varchar("subject", { length: 120 }),
    userId: uuid("user_id").notNull(),
    score: integer("score").notNull(),
    periodKey: varchar("period_key", { length: 20 }).notNull(), // e.g. "2026-W33"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    boardIdx: index("leaderboard_snapshots_board_idx").on(table.periodKey, table.region, table.subject, table.score),
    // one row per (user, region, subject, period) so refreshing is an upsert, not an ever-growing log
    upsertKey: uniqueIndex("leaderboard_snapshots_upsert_key").on(table.userId, table.region, table.subject, table.periodKey),
  })
);

// ---- RAG: curriculum knowledge base (new — this is what was missing) -------
export const curriculumDocuments = pgTable("curriculum_documents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  level: schoolLevelEnum("level").notNull(),
  subject: varchar("subject", { length: 120 }).notNull(),
  sourceType: varchar("source_type", { length: 40 }).notNull(), // "official_curriculum" | "summary" | "textbook_excerpt"
  sourceUrl: varchar("source_url", { length: 500 }),
  storagePath: varchar("storage_path", { length: 500 }), // original PDF in Supabase Storage, if any
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const curriculumChunks = pgTable(
  "curriculum_chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id").notNull().references(() => curriculumDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    // Gemini embedding model configured by lib/rag.ts is stored at 768 dimensions
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    docIdx: index("curriculum_chunks_doc_idx").on(table.documentId, table.chunkIndex),
    // ivfflat index created directly in SQL migration (drizzle-kit can't express it yet)
  })
);

// ---- study workspace: student-uploaded documents (new — replaces the mocked
// PDF/YouTube importer + copilot + quiz generator in app/study/page.tsx) -----
export const studentDocuments = pgTable(
  "student_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    sourceType: varchar("source_type", { length: 20 }).notNull(), // "pdf" | "youtube"
    storagePath: varchar("storage_path", { length: 500 }), // Supabase Storage path in the "study-uploads" bucket, for PDFs
    sourceUrl: varchar("source_url", { length: 500 }), // original YouTube URL, if applicable
    status: varchar("status", { length: 20 }).notNull().default("processing"), // "processing" | "ready" | "failed"
    errorMessage: text("error_message"),
    summary: jsonb("summary"), // { mainIdea, keyPoints[], workedExample? } generated once ingestion succeeds
    charCount: integer("char_count"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ userIdx: index("student_documents_user_idx").on(table.userId, table.createdAt) })
);

export const studentDocumentChunks = pgTable(
  "student_document_chunks",
  {
    id: serial("id").primaryKey(),
    documentId: uuid("document_id").notNull().references(() => studentDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({ docIdx: index("student_document_chunks_doc_idx").on(table.documentId, table.chunkIndex) })
);
