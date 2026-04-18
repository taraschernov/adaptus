import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { sessions, messages, vocabCards, achievements, profiles, topicHistory } from "@shared/schema";
import type {
  Session, Message, VocabCard, Achievement, Profile, TopicHistory,
  InsertSession, InsertMessage, InsertVocabCard, InsertProfile,
} from "@shared/schema";
import { eq, desc, and, lte } from "drizzle-orm";

const sqlite = new Database("lang-tutor.db");
export const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatar TEXT NOT NULL DEFAULT '🧑',
    mode TEXT NOT NULL DEFAULT 'adult',
    telegram_id TEXT,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    telegram_id TEXT,
    language TEXT NOT NULL DEFAULT 'bg',
    level TEXT NOT NULL DEFAULT 'beginner',
    tts_provider TEXT NOT NULL DEFAULT 'google',
    cefr_level TEXT NOT NULL DEFAULT 'A1',
    active_scenario TEXT,
    vocab_count INTEGER NOT NULL DEFAULT 0,
    mode TEXT NOT NULL DEFAULT 'adult',
    active_topic_id TEXT,
    active_topic_title TEXT,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,
    total_xp INTEGER NOT NULL DEFAULT 0,
    daily_xp INTEGER NOT NULL DEFAULT 0,
    daily_goal_xp INTEGER NOT NULL DEFAULT 50,
    last_activity_date TEXT,
    streak_freezes INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'bg',
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS vocab_cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    context TEXT,
    language TEXT NOT NULL,
    image_emoji TEXT,
    repetitions INTEGER NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval INTEGER NOT NULL DEFAULT 1,
    next_review INTEGER,
    last_quality INTEGER,
    fail_streak INTEGER NOT NULL DEFAULT 0,
    is_hard INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS topic_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    topic_id TEXT NOT NULL,
    topic_title TEXT NOT NULL,
    language TEXT NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 0,
    words_learned INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER
  );
`);

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function checkAndUpdateStreak(session: Session): Partial<Session> {
  const today = todayStr();
  if (session.lastActivityDate === today) return {}; // уже занимались сегодня

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = session.currentStreak;
  let newFreezes = session.streakFreezes;

  if (session.lastActivityDate === yesterdayStr) {
    // Занимались вчера — продолжаем серию
    newStreak += 1;
  } else if (session.lastActivityDate) {
    // Пропустили день
    if (session.streakFreezes > 0) {
      newFreezes -= 1; // используем заморозку
    } else {
      newStreak = 1; // сбрасываем серию
    }
  } else {
    newStreak = 1; // первый раз
  }

  return {
    currentStreak: newStreak,
    longestStreak: Math.max(session.longestStreak, newStreak),
    lastActivityDate: today,
    dailyXP: 0, // сброс ежедневного XP
    streakFreezes: newFreezes,
  };
}

// ── Interface ────────────────────────────────────────────────────────────────

export interface IStorage {
  // Profiles
  createProfile(data: InsertProfile): Profile;
  getProfile(id: number): Profile | undefined;
  getAllProfiles(): Profile[];

  // Sessions
  createSession(data: InsertSession): Session;
  getSession(id: number): Session | undefined;
  updateSession(id: number, data: Partial<Session>): void;

  // Gamification
  addXP(sessionId: number, amount: number): Session;
  checkAchievement(sessionId: number, achievementId: string): boolean;
  unlockAchievement(sessionId: number, achievementId: string): Achievement | null;
  getAchievements(sessionId: number): Achievement[];

  // Messages
  getMessages(sessionId: number): Message[];
  addMessage(data: InsertMessage): Message;

  // Vocab
  getVocabCards(sessionId: number): VocabCard[];
  getVocabCard(id: number): VocabCard | undefined;
  addVocabCard(data: InsertVocabCard): VocabCard;
  updateVocabCard(id: number, data: Partial<VocabCard>): VocabCard | undefined;
  getHardWords(sessionId: number): VocabCard[];
  getDueCards(sessionId: number): VocabCard[];

  // Topic history
  addTopicHistory(data: Omit<TopicHistory, "id" | "completedAt">): TopicHistory;
  getTopicHistory(sessionId: number): TopicHistory[];
}

// ── Implementation ────────────────────────────────────────────────────────────

export class Storage implements IStorage {

  // Profiles
  createProfile(data: InsertProfile): Profile {
    return db.insert(profiles).values({ ...data, createdAt: new Date() }).returning().get();
  }
  getProfile(id: number): Profile | undefined {
    return db.select().from(profiles).where(eq(profiles.id, id)).get();
  }
  getAllProfiles(): Profile[] {
    return db.select().from(profiles).all();
  }

  // Sessions
  createSession(data: InsertSession): Session {
    return db.insert(sessions).values({ ...data, createdAt: new Date() }).returning().get();
  }
  getSession(id: number): Session | undefined {
    return db.select().from(sessions).where(eq(sessions.id, id)).get();
  }
  updateSession(id: number, data: Partial<Session>): void {
    db.update(sessions).set(data).where(eq(sessions.id, id)).run();
  }

  // Gamification
  addXP(sessionId: number, amount: number): Session {
    const session = this.getSession(sessionId);
    if (!session) throw new Error("Session not found");

    const streakUpdate = checkAndUpdateStreak(session);
    const newTotalXP = session.totalXP + amount;
    const newDailyXP = (streakUpdate.dailyXP ?? session.dailyXP) + amount;

    const update: Partial<Session> = {
      ...streakUpdate,
      totalXP: newTotalXP,
      dailyXP: newDailyXP,
    };

    db.update(sessions).set(update).where(eq(sessions.id, sessionId)).run();
    return this.getSession(sessionId)!;
  }

  checkAchievement(sessionId: number, achievementId: string): boolean {
    const existing = db.select().from(achievements)
      .where(and(eq(achievements.sessionId, sessionId), eq(achievements.achievementId, achievementId)))
      .get();
    return !!existing;
  }

  unlockAchievement(sessionId: number, achievementId: string): Achievement | null {
    if (this.checkAchievement(sessionId, achievementId)) return null;
    return db.insert(achievements).values({
      sessionId, achievementId, unlockedAt: new Date()
    }).returning().get();
  }

  getAchievements(sessionId: number): Achievement[] {
    return db.select().from(achievements).where(eq(achievements.sessionId, sessionId)).all();
  }

  // Messages
  getMessages(sessionId: number): Message[] {
    return db.select().from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(desc(messages.id))
      .all()
      .reverse()
      .slice(-20);
  }
  addMessage(data: InsertMessage): Message {
    return db.insert(messages).values({ ...data, createdAt: new Date() }).returning().get();
  }

  // Vocab
  getVocabCards(sessionId: number): VocabCard[] {
    return db.select().from(vocabCards).where(eq(vocabCards.sessionId, sessionId)).all();
  }
  getVocabCard(id: number): VocabCard | undefined {
    return db.select().from(vocabCards).where(eq(vocabCards.id, id)).get();
  }
  addVocabCard(data: InsertVocabCard): VocabCard {
    return db.insert(vocabCards).values(data).returning().get();
  }
  updateVocabCard(id: number, data: Partial<VocabCard>): VocabCard | undefined {
    return db.update(vocabCards).set(data).where(eq(vocabCards.id, id)).returning().get();
  }
  getHardWords(sessionId: number): VocabCard[] {
    return db.select().from(vocabCards)
      .where(and(eq(vocabCards.sessionId, sessionId), eq(vocabCards.isHard, 1)))
      .all();
  }
  getDueCards(sessionId: number): VocabCard[] {
    const now = new Date();
    return db.select().from(vocabCards)
      .where(and(
        eq(vocabCards.sessionId, sessionId),
        lte(vocabCards.nextReview, now)
      ))
      .all();
  }

  // Topic history
  addTopicHistory(data: Omit<TopicHistory, "id" | "completedAt">): TopicHistory {
    return db.insert(topicHistory).values({ ...data, completedAt: new Date() }).returning().get();
  }
  getTopicHistory(sessionId: number): TopicHistory[] {
    return db.select().from(topicHistory)
      .where(eq(topicHistory.sessionId, sessionId))
      .orderBy(desc(topicHistory.id))
      .all();
  }
}

export const storage = new Storage();
