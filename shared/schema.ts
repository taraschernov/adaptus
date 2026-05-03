import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Profiles (взрослый / детский) ──────────────────────────────────────────
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),                          // "Тарас" / "Никита"
  avatar: text("avatar").notNull().default("🧑"),       // emoji аватар
  mode: text("mode").notNull().default("adult"),        // "adult" | "kid"
  telegramId: text("telegram_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  profileId: integer("profile_id"),                      // привязка к профилю
  telegramId: text("telegram_id"),
  language: text("language").notNull().default("bg"),
  level: text("level").notNull().default("beginner"),
  ttsProvider: text("tts_provider").notNull().default("google"),
  cefrLevel: text("cefr_level").notNull().default("A1"),
  activeScenario: text("active_scenario"),
  vocabCount: integer("vocab_count").notNull().default(0),
  mode: text("mode").notNull().default("adult"),         // "adult" | "kid"
  learningFocus: text("learning_focus").notNull().default("balanced"),
  // Topic Talk
  activeTopicId: text("active_topic_id"),
  activeTopicTitle: text("active_topic_title"),
  // Gamification
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  totalXP: integer("total_xp").notNull().default(0),
  dailyXP: integer("daily_xp").notNull().default(0),
  dailyGoalXP: integer("daily_goal_xp").notNull().default(50),
  lastActivityDate: text("last_activity_date"),          // YYYY-MM-DD
  streakFreezes: integer("streak_freezes").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Messages ────────────────────────────────────────────────────────────────
export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull().default("bg"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Vocabulary cards (SM-2) ─────────────────────────────────────────────────
export const vocabCards = sqliteTable("vocab_cards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  word: text("word").notNull(),
  translation: text("translation").notNull(),
  context: text("context"),
  language: text("language").notNull(),
  imageEmoji: text("image_emoji"),                       // для детского режима
  // SM-2
  repetitions: integer("repetitions").notNull().default(0),
  easeFactor: real("ease_factor").notNull().default(2.5),
  interval: integer("interval").notNull().default(1),
  nextReview: integer("next_review", { mode: "timestamp" }).$defaultFn(() => new Date()),
  lastQuality: integer("last_quality"),
  // Hard word tracking
  failStreak: integer("fail_streak").notNull().default(0),  // подряд неправильных
  isHard: integer("is_hard").notNull().default(0),          // 0/1 bool
});

// ─── Achievements ────────────────────────────────────────────────────────────
export const achievements = sqliteTable("achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  achievementId: text("achievement_id").notNull(),       // "first_word", "streak_7" etc
  unlockedAt: integer("unlocked_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Topic history ────────────────────────────────────────────────────────────
export const topicHistory = sqliteTable("topic_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id").notNull(),
  topicId: text("topic_id").notNull(),
  topicTitle: text("topic_title").notNull(),
  language: text("language").notNull(),
  xpEarned: integer("xp_earned").notNull().default(0),
  wordsLearned: integer("words_learned").notNull().default(0),
  completedAt: integer("completed_at", { mode: "timestamp" }).$defaultFn(() => new Date()),
});

// ─── Schemas & Types ──────────────────────────────────────────────────────────
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true });
export const insertSessionSchema = createInsertSchema(sessions).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertVocabCardSchema = createInsertSchema(vocabCards).omit({ id: true });
export const insertAchievementSchema = createInsertSchema(achievements).omit({ id: true, unlockedAt: true });

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type VocabCard = typeof vocabCards.$inferSelect;
export type InsertVocabCard = z.infer<typeof insertVocabCardSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type TopicHistory = typeof topicHistory.$inferSelect;
