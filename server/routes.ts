import type { Express } from "express";
import { Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertSessionSchema } from "@shared/schema";
import { synthesize, getAvailableProviders } from "./tts";
import { sm2, isDueToday } from "./sm2";
import { LEVELS } from "@shared/levels";
import { getScenario, getScenariosForLanguage, ALL_SCENARIOS } from "@shared/scenarios";
import { getTopic, getTopicsForLanguage, ALL_TOPICS, TOPIC_CATEGORIES } from "@shared/topics";
import { ACHIEVEMENTS, ACHIEVEMENT_MAP } from "@shared/achievements";

const XP = {
  message: 5,
  voice: 8,
  exercise_correct: 10,
  exercise_perfect: 15,
  topic_session: 20,
  scenario_complete: 30,
  word_added: 2,
  hard_word: 5,
};

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(
  language: "bg" | "en",
  cefrLevel: string,
  scenarioId?: string | null,
  topicId?: string | null,
  topicTitle?: string | null,
  mode: "adult" | "kid" = "adult",
  hardWords: string[] = []
): string {
  const levelCfg = (LEVELS as any)[cefrLevel] || LEVELS.A1;
  const scenario = scenarioId ? getScenario(scenarioId) : null;
  const topic = topicId ? getTopic(topicId) : null;

  const langLabel = language === "bg" ? "болгарском" : "английском";

  let prompt: string;

  if (mode === "kid") {
    // ── Детский режим ──
    prompt = `Ты — весёлый AI-учитель по имени Адаптус для школьника (6 класс, ~11-12 лет).
Ты помогаешь учить ${langLabel} язык через игры, картинки и весёлые диалоги.

ПРАВИЛА ДЛЯ ДЕТСКОГО РЕЖИМА:
- Говори просто, коротко, весело
- Используй эмодзи 🎉✨🌟🎮 чтобы было интереснее
- Хвали за каждый правильный ответ: "Отлично! 🌟", "Молодец! ⭐"
- Если ошибка — мягко исправь: "Почти! Правильно будет..."
- Задавай простые вопросы, предлагай угадать, играй в загадки
- НИКОГДА не используй сложные грамматические термины
- Максимум 2-3 предложения за раз
- Добавляй слово/картинку после каждого нового слова: слово (перевод) 🖼️

УРОВЕНЬ: ${levelCfg.label}
${levelCfg.aiInstructions}`;
  } else {
    // ── Взрослый режим ──
    prompt = `Ты — AI-репетитор по языкам. Твоё имя — Адаптус.
Ты помогаешь экспатам в Болгарии выучить ${langLabel} язык.

━━━ УРОВЕНЬ: ${levelCfg.label} ━━━
${levelCfg.aiInstructions}`;
  }

  // Трудные слова — вплетаем в диалог
  if (hardWords.length > 0) {
    prompt += `\n\n━━━ ТРУДНЫЕ СЛОВА (вплетай естественно) ━━━
Пользователь плохо запомнил: ${hardWords.slice(0, 3).join(", ")}.
Используй эти слова в разговоре естественно 1-2 раза, чтобы закрепить.`;
  }

  // Блок vocab
  prompt += `\n\n━━━ ВЫДЕЛЕНИЕ СЛОВ ━━━
В КАЖДОМ ответе добавляй JSON-блок с 1-3 словами:
{"vocab": [{"word": "...", "translation": "...", "lang": "${language}", "context": "предложение", "emoji": "📖"}]}`;

  // Сценарий
  if (scenario) {
    prompt += `\n\n━━━ АКТИВНЫЙ СЦЕНАРИЙ: ${scenario.emoji} ${scenario.title} ━━━
МЕСТО: ${scenario.setting}
РОЛЬ AI: ${scenario.aiRole}
РОЛЬ ПОЛЬЗОВАТЕЛЯ: ${scenario.userRole}
ЦЕЛЬ: ${scenario.goal}
КЛЮЧЕВЫЕ ФРАЗЫ: ${scenario.successHints.join(", ")}

ПРАВИЛА СЦЕНАРИЯ:
- Играй роль реалистично
- Если ошибка — персонаж может не понять, затем дай подсказку
- Когда цель достигнута — поздравь и добавь: {"task_complete": true}`;
  }

  // Topic Talk
  else if (topic || topicTitle) {
    const t = topic;
    prompt += `\n\n━━━ РЕЖИМ: БЕСЕДА ПО ТЕМЕ 🗺️ ━━━
ТЕМА: ${t ? `${t.emoji} ${t.title}` : topicTitle}
${t ? `КОНТЕКСТ:\n${t.context}` : `Обсуждай тему "${topicTitle}" свободно на ${langLabel} языке.`}

ПРАВИЛА БЕСЕДЫ:
- Веди живой диалог, НЕ читай лекцию
- Задавай вопросы пользователю, жди ответа
- Адаптируй сложность под уровень ${cefrLevel}
- Объясняй новые слова через контекст
- Если RSS/новость — перескажи коротко, потом обсудите мнения`;
  }

  // Свободный чат
  else {
    prompt += `\n\n━━━ РЕЖИМ: СВОБОДНЫЙ ЧАТ ━━━
Темы для болгарского: бюрокрация, жильё, транспорт, здоровье, покупки, жизнь в Болгарии.
Темы для английского: деловое общение, IT, small talk, переговоры.`;
  }

  return prompt;
}

// ─── Упражнения генерация ─────────────────────────────────────────────────────

async function generateExercise(
  sessionId: number,
  exerciseType: "translate" | "cloze" | "word_order",
  language: "bg" | "en",
  cefrLevel: string,
  mode: "adult" | "kid"
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  // Берём слова из словаря сессии для дистракторов
  const vocabCards = storage.getVocabCards(sessionId);
  const recentWords = vocabCards.slice(-20).map(c => `${c.word} = ${c.translation}`).join(", ");

  const kidNote = mode === "kid" ? "Используй простые слова для детей 11-12 лет." : "";
  const langLabel = language === "bg" ? "болгарском" : "английском";

  const prompts: Record<string, string> = {
    translate: `Создай упражнение "переведи слово" на ${langLabel} языке, уровень CEFR ${cefrLevel}.
${kidNote}
Слова из словаря пользователя (можно использовать): ${recentWords || "нет слов, придумай сам"}.
Верни ТОЛЬКО JSON (без markdown):
{
  "type": "translate",
  "word": "слово на ${language === "bg" ? "болгарском" : "английском"}",
  "correctAnswer": "правильный перевод на русский",
  "options": ["правильный", "дистрактор1", "дистрактор2", "дистрактор3"],
  "hint": "подсказка (например: часть речи или контекст)"
}`,

    cloze: `Создай упражнение "заполни пропуск" на ${langLabel} языке, уровень CEFR ${cefrLevel}.
${kidNote}
Слова из словаря пользователя: ${recentWords || "нет, придумай сам"}.
Верни ТОЛЬКО JSON:
{
  "type": "cloze",
  "sentence": "предложение с ___ вместо пропущенного слова",
  "sentenceRu": "перевод предложения на русский",
  "correctAnswer": "пропущенное слово",
  "options": ["правильное", "дистрактор1", "дистрактор2", "дистрактор3"]
}`,

    word_order: `Создай упражнение "составь предложение" на ${langLabel} языке, уровень CEFR ${cefrLevel}.
${kidNote}
Верни ТОЛЬКО JSON:
{
  "type": "word_order",
  "words": ["слово1", "слово2", "слово3", "слово4", "слово5"],
  "correctOrder": [0, 2, 1, 3, 4],
  "correctSentence": "правильное предложение",
  "translation": "перевод на русский"
}`,
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompts[exerciseType] }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 256 },
      }),
    }
  );

  if (!response.ok) throw new Error("Gemini error generating exercise");
  const data = await response.json() as any;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Парсим JSON из ответа
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid exercise format from AI");
  const exercise = JSON.parse(jsonMatch[0]);

  // Перемешиваем варианты ответа
  if (exercise.options) {
    exercise.options = exercise.options.sort(() => Math.random() - 0.5);
  }

  return exercise;
}

// ─── AI providers (Gemini primary + OpenRouter fallback) ────────────────────

type AIResult = { text: string; vocab: Array<{ word: string; translation: string; lang: string; context?: string; emoji?: string }>; taskComplete?: boolean };

function parseAIResponse(rawText: string): AIResult {
  let vocab: AIResult["vocab"] = [];
  let taskComplete = false;
  let cleanText = rawText;

  const vocabMatch = rawText.match(/\{"vocab":\s*\[[\s\S]*?\]\}/);
  if (vocabMatch) {
    try { vocab = JSON.parse(vocabMatch[0]).vocab || []; cleanText = cleanText.replace(vocabMatch[0], "").trim(); } catch {}
  }
  const taskMatch = cleanText.match(/\{"task_complete":\s*(true|false)\}/);
  if (taskMatch) {
    taskComplete = taskMatch[1] === "true";
    cleanText = cleanText.replace(taskMatch[0], "").trim();
  }
  return { text: cleanText, vocab, taskComplete };
}

// 1. Gemini (primary)
async function callGeminiDirect(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<AIResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const contents = [
    ...history.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 429) throw Object.assign(new Error("quota"), { isQuota: true });
    throw new Error(`Gemini error: ${errText}`);
  }
  const data = await response.json() as any;
  const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  let vocab: Array<{ word: string; translation: string; lang: string; context?: string; emoji?: string }> = [];
  let taskComplete = false;
  let cleanText = rawText;

  // Парсим vocab JSON
  const vocabMatch = rawText.match(/\{"vocab":\s*\[[\s\S]*?\]\}/);
  if (vocabMatch) {
    try {
      vocab = JSON.parse(vocabMatch[0]).vocab || [];
      cleanText = cleanText.replace(vocabMatch[0], "").trim();
    } catch {}
  }

  // Парсим task_complete
  const taskMatch = cleanText.match(/\{"task_complete":\s*(true|false)\}/);
  if (taskMatch) {
    taskComplete = taskMatch[1] === "true";
    cleanText = cleanText.replace(taskMatch[0], "").trim();
  }

  return parseAIResponse(rawText);
}

// 2. OpenRouter fallback (free models, OpenAI-compatible API)
async function callOpenRouter(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<AIResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  // Ordered list of free models — verified working 2025-04 via /api/v1/models
  const FREE_MODELS = [
    "openai/gpt-oss-120b:free",         // GPT-class, 120B
    "nvidia/nemotron-3-super-120b-a12b:free", // Nvidia 120B
    "google/gemma-4-31b-it:free",       // Google Gemma 4
    "google/gemma-4-26b-a4b-it:free",   // Google Gemma 4 (MoE)
    "qwen/qwen3-next-80b-a3b-instruct:free", // Qwen 80B
    "openrouter/free",                  // Generic free fallback
  ];

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
    { role: "user", content: userMessage },
  ];

  let lastErr = "";
  for (const model of FREE_MODELS) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lang-tutor-production.up.railway.app",
        "X-Title": "Adaptus Language Tutor",
      },
      body: JSON.stringify({ model, messages, max_tokens: 512, temperature: 0.7 }),
    });

    if (response.ok) {
      const data = await response.json() as any;
      const rawText: string = data.choices?.[0]?.message?.content || "";
      console.log(`[AI] OpenRouter responded via model: ${model}`);
      return parseAIResponse(rawText);
    }

    const errBody = await response.text();
    lastErr = `${model}: ${errBody}`;
    console.warn(`[AI] OpenRouter model ${model} failed (${response.status}), trying next…`);
  }

  throw new Error(`Все резервные AI недоступны. Последняя ошибка: ${lastErr}`);
}

// 3. Unified AI call: Gemini first → OpenRouter on quota
async function callAI(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string
): Promise<AIResult> {
  try {
    return await callGeminiDirect(systemPrompt, history, userMessage);
  } catch (err: any) {
    if (err?.isQuota && process.env.OPENROUTER_API_KEY) {
      console.warn("[AI] Gemini quota hit — switching to OpenRouter fallback");
      return await callOpenRouter(systemPrompt, history, userMessage);
    }
    // No fallback available or non-quota error
    if (err?.isQuota) {
      throw new Error("Лимит AI исчерпан. Добавьте OPENROUTER_API_KEY для работы без ограничений (бесплатно на openrouter.ai).");
    }
    throw err;
  }
}

// ─── Deepgram STT ─────────────────────────────────────────────────────────────

async function transcribeAudio(audioBuffer: Buffer, language: string): Promise<string> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("DEEPGRAM_API_KEY not set");
  const lang = language === "bg" ? "bg" : "en-US";
  const response = await fetch(
    `https://api.deepgram.com/v1/listen?model=nova-3&language=${lang}&smart_format=true`,
    {
      method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": "audio/webm" },
      body: audioBuffer,
    }
  );
  if (!response.ok) throw new Error("Deepgram STT failed");
  const data = await response.json() as any;
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

// ─── Achievement checker ──────────────────────────────────────────────────────

function checkAndUnlockAchievements(
  sessionId: number,
  session: any,
  vocabCount: number
): Array<{ id: string; title: string; emoji: string; xpReward: number }> {
  const unlocked: Array<{ id: string; title: string; emoji: string; xpReward: number }> = [];

  const tryUnlock = (achievementId: string) => {
    const def = ACHIEVEMENT_MAP[achievementId];
    if (!def) return;
    const result = storage.unlockAchievement(sessionId, achievementId);
    if (result) {
      unlocked.push({ id: achievementId, title: def.title, emoji: def.emoji, xpReward: def.xpReward });
    }
  };

  // Слова
  if (vocabCount >= 1) tryUnlock("first_word");
  if (vocabCount >= 10) tryUnlock("words_10");
  if (vocabCount >= 50) tryUnlock("words_50");
  if (vocabCount >= 100) tryUnlock("words_100");

  // Streak
  if (session.currentStreak >= 3) tryUnlock("streak_3");
  if (session.currentStreak >= 7) tryUnlock("streak_7");
  if (session.currentStreak >= 30) tryUnlock("streak_30");

  // Уровни
  if (session.cefrLevel === "A2") tryUnlock("level_a2");
  if (session.cefrLevel === "B1") tryUnlock("level_b1");
  if (session.cefrLevel === "B2") tryUnlock("level_b2");

  return unlocked;
}

// ─── Register routes ──────────────────────────────────────────────────────────

export function registerRoutes(httpServer: Server, app: Express) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let sessionId: number | null = null;
    let language: "bg" | "en" = "bg";
    let ttsProvider: string = "google";
    let mode: "adult" | "kid" = "adult";
    let audioChunks: Buffer[] = [];
    let isRecording = false;

    ws.on("message", async (data: any, isBinary: boolean) => {
      try {
        // В ws@8 текстовые сообщения приходят как Buffer, но isBinary === false
        if (!isBinary) {
          const msg = JSON.parse(data.toString());

          // ── Ping/pong heartbeat (Railway / Render idle timeout fix) ──
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
            return;
          }

          // ── Init session ──
          if (msg.type === "init") {
            const session = storage.createSession({
              telegramId: msg.telegramId || null,
              language: msg.language || "bg",
              level: msg.level || "beginner",
              ttsProvider: msg.ttsProvider || "google",
              cefrLevel: msg.cefrLevel || "A1",
              activeScenario: msg.activeScenario || null,
              mode: msg.mode || "adult",
            });
            sessionId = session.id;
            language = (msg.language || "bg") as "bg" | "en";
            ttsProvider = msg.ttsProvider || "google";
            mode = (msg.mode || "adult") as "adult" | "kid";
            ws.send(JSON.stringify({ type: "session", sessionId }));

          // ── Text message ──
          } else if (msg.type === "text_message") {
            if (!sessionId) {
              ws.send(JSON.stringify({ type: "error", message: "Сессия истекла (сервер перезапущен). Пожалуйста, обновите страницу." }));
              return;
            }
            const session = storage.getSession(sessionId);
            if (!session) {
              ws.send(JSON.stringify({ type: "error", message: "Сессия потеряна в базе данных. Пожалуйста, обновите страницу." }));
              return;
            }

            // XP за сообщение
            const updatedSession = storage.addXP(sessionId, XP.message);
            const hardWords = storage.getHardWords(sessionId).map(c => c.word);

            storage.addMessage({ sessionId, role: "user", content: msg.text, language: session.language });
            const history = storage.getMessages(sessionId);
            const systemPrompt = buildSystemPrompt(
              session.language as "bg" | "en",
              session.cefrLevel || "A1",
              session.activeScenario,
              session.activeTopicId,
              session.activeTopicTitle,
              (session.mode || "adult") as "adult" | "kid",
              hardWords
            );

            ws.send(JSON.stringify({ type: "thinking" }));
            const { text, vocab, taskComplete } = await callAI(systemPrompt, history.slice(0, -1), msg.text);
            storage.addMessage({ sessionId, role: "assistant", content: text, language: session.language });

            // Сохраняем слова
            let newVocabCount = 0;
            for (const v of vocab) {
              storage.addVocabCard({
                sessionId, word: v.word, translation: v.translation,
                context: v.context || null, language: v.lang,
                imageEmoji: v.emoji || null,
                repetitions: 0, easeFactor: 2.5, interval: 1,
                nextReview: new Date(), lastQuality: null,
                failStreak: 0, isHard: 0,
              });
              storage.addXP(sessionId, XP.word_added);
              newVocabCount++;
            }

            // Обновляем счётчик слов
            const allCards = storage.getVocabCards(sessionId);
            storage.updateSession(sessionId, { vocabCount: allCards.length });

            // Проверяем ачивки
            const freshSession = storage.getSession(sessionId)!;
            const newAchievements = checkAndUnlockAchievements(sessionId, freshSession, allCards.length);
            if (newAchievements.length > 0) {
              // Добавляем XP за ачивки
              for (const a of newAchievements) {
                storage.addXP(sessionId, a.xpReward);
              }
            }

            // Первый диалог
            if (history.length <= 2) {
              const a = storage.unlockAchievement(sessionId, "first_dialog");
              if (a) {
                const def = ACHIEVEMENT_MAP["first_dialog"];
                newAchievements.push({ id: "first_dialog", title: def.title, emoji: def.emoji, xpReward: def.xpReward });
                storage.addXP(sessionId, def.xpReward);
              }
            }

            const finalSession = storage.getSession(sessionId)!;
            ws.send(JSON.stringify({
              type: "text_response", text, vocab, taskComplete,
              xp: finalSession.totalXP, dailyXP: finalSession.dailyXP,
              streak: finalSession.currentStreak,
              newAchievements,
            }));

            // TTS
            const audio = await synthesize(text, session.language, ttsProvider);
            if (audio) ws.send(JSON.stringify({ type: "audio_response", audio: audio.toString("base64") }));

          // ── Voice recording ──
          } else if (msg.type === "audio_start") {
            isRecording = true;
            audioChunks = [];
            language = msg.language || language;

          } else if (msg.type === "audio_end") {
            isRecording = false;
            if (!audioChunks.length) return;
            if (!sessionId) {
              ws.send(JSON.stringify({ type: "error", message: "Сессия истекла (сервер перезапущен). Пожалуйста, обновите страницу." }));
              return;
            }
            const buf = Buffer.concat(audioChunks);
            audioChunks = [];

            if (!process.env.DEEPGRAM_API_KEY) {
              ws.send(JSON.stringify({ type: "error", message: "DEEPGRAM_API_KEY не задан — голос недоступен" }));
              return;
            }

            ws.send(JSON.stringify({ type: "transcribing" }));
            const transcript = await transcribeAudio(buf, language);
            if (!transcript.trim()) {
              ws.send(JSON.stringify({ type: "error", message: "Речь не распознана. Попробуй ещё раз." }));
              return;
            }

            ws.send(JSON.stringify({ type: "transcript", text: transcript }));

            const session = storage.getSession(sessionId)!;
            const updatedSession = storage.addXP(sessionId, XP.voice);
            const hardWords = storage.getHardWords(sessionId).map(c => c.word);

            storage.addMessage({ sessionId, role: "user", content: transcript, language: session.language });
            const history = storage.getMessages(sessionId);
            const systemPrompt = buildSystemPrompt(
              session.language as "bg" | "en",
              session.cefrLevel || "A1",
              session.activeScenario,
              session.activeTopicId,
              session.activeTopicTitle,
              (session.mode || "adult") as "adult" | "kid",
              hardWords
            );

            ws.send(JSON.stringify({ type: "thinking" }));
            const { text, vocab, taskComplete } = await callAI(systemPrompt, history.slice(0, -1), transcript);
            storage.addMessage({ sessionId, role: "assistant", content: text, language: session.language });

            for (const v of vocab) {
              storage.addVocabCard({
                sessionId, word: v.word, translation: v.translation,
                context: v.context || null, language: v.lang,
                imageEmoji: v.emoji || null,
                repetitions: 0, easeFactor: 2.5, interval: 1,
                nextReview: new Date(), lastQuality: null,
                failStreak: 0, isHard: 0,
              });
              storage.addXP(sessionId, XP.word_added);
            }

            const allCards = storage.getVocabCards(sessionId);
            storage.updateSession(sessionId, { vocabCount: allCards.length });

            const finalSession = storage.getSession(sessionId)!;
            ws.send(JSON.stringify({ type: "text_response", text, vocab, taskComplete, xp: finalSession.totalXP, streak: finalSession.currentStreak, newAchievements: [] }));

            const audio = await synthesize(text, session.language, ttsProvider);
            if (audio) ws.send(JSON.stringify({ type: "audio_response", audio: audio.toString("base64") }));

          // ── SM-2 review card ──
          } else if (msg.type === "review_card") {
            const card = storage.getVocabCard(msg.cardId);
            if (!card) return;

            const result = sm2({ quality: msg.quality, repetitions: card.repetitions, easeFactor: card.easeFactor, interval: card.interval });

            // Обновляем счётчик ошибок для "трудных слов"
            const isWrong = msg.quality < 3;
            const newFailStreak = isWrong ? (card.failStreak || 0) + 1 : 0;
            const isHard = newFailStreak >= 3 ? 1 : card.isHard;

            storage.updateVocabCard(msg.cardId, {
              repetitions: result.repetitions, easeFactor: result.easeFactor,
              interval: result.interval, nextReview: result.nextReview,
              lastQuality: msg.quality, failStreak: newFailStreak, isHard,
            });

            // XP за повторение
            if (sessionId) {
              storage.addXP(sessionId, isWrong ? 3 : 8);
              if (isHard && !isWrong) {
                const def = ACHIEVEMENT_MAP["hard_word_broken"];
                const a = storage.unlockAchievement(sessionId, "hard_word_broken");
                if (a) storage.addXP(sessionId, def.xpReward);
              }
            }

            ws.send(JSON.stringify({ type: "card_reviewed", cardId: msg.cardId, nextReview: result.nextReview, interval: result.interval, isHard }));

          // ── Set topic ──
          } else if (msg.type === "set_topic") {
            if (!sessionId) return;
            const topic = msg.topicId ? getTopic(msg.topicId) : null;
            const title = topic?.title || msg.topicTitle || null;
            storage.updateSession(sessionId, { activeTopicId: msg.topicId || null, activeTopicTitle: title });
            ws.send(JSON.stringify({ type: "topic_set", topicId: msg.topicId || null, topicTitle: title }));
            if (msg.topicId) {
              const a = storage.unlockAchievement(sessionId, "first_topic");
              if (a) storage.addXP(sessionId, ACHIEVEMENT_MAP["first_topic"].xpReward);
            }

          // ── Switch settings ──
          } else if (msg.type === "switch_language") {
            language = msg.language;
            if (sessionId) storage.updateSession(sessionId, { language: msg.language });
            ws.send(JSON.stringify({ type: "language_switched", language }));

          } else if (msg.type === "switch_tts") {
            ttsProvider = msg.provider;
            if (sessionId) storage.updateSession(sessionId, { ttsProvider: msg.provider });
            ws.send(JSON.stringify({ type: "tts_switched", provider: msg.provider }));

          } else if (msg.type === "set_scenario") {
            if (sessionId) storage.updateSession(sessionId, { activeScenario: msg.scenarioId || null, activeTopicId: null, activeTopicTitle: null });
            ws.send(JSON.stringify({ type: "scenario_set", scenarioId: msg.scenarioId || null }));
            if (msg.scenarioId) {
              const a = storage.unlockAchievement(sessionId!, "first_scenario");
              if (a) storage.addXP(sessionId!, ACHIEVEMENT_MAP["first_scenario"].xpReward);
            }

          } else if (msg.type === "set_cefr_level") {
            if (sessionId) storage.updateSession(sessionId, { cefrLevel: msg.level });
            ws.send(JSON.stringify({ type: "cefr_level_set", level: msg.level }));

          } else if (msg.type === "set_mode") {
            mode = msg.mode;
            if (sessionId) storage.updateSession(sessionId, { mode: msg.mode });
            ws.send(JSON.stringify({ type: "mode_set", mode: msg.mode }));
          }

        } else {
          if (isRecording) audioChunks.push(data as Buffer);
        }

      } catch (err: any) {
        ws.send(JSON.stringify({ type: "error", message: err.message || "Server error" }));
      }
    });
  });

  // ── REST API ──────────────────────────────────────────────────────────────

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      hasGemini: !!process.env.GEMINI_API_KEY,
      hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
      hasDeepgram: !!process.env.DEEPGRAM_API_KEY,
      ttsProviders: getAvailableProviders()
    });
  });

  // Sessions
  app.get("/api/sessions/:id", (req, res) => {
    const s = storage.getSession(Number(req.params.id));
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json(s);
  });
  app.get("/api/sessions/:id/messages", (req, res) => res.json(storage.getMessages(Number(req.params.id))));
  app.get("/api/sessions/:id/vocab", (req, res) => res.json(storage.getVocabCards(Number(req.params.id))));
  app.get("/api/sessions/:id/vocab/due", (req, res) => res.json(storage.getDueCards(Number(req.params.id))));
  app.get("/api/sessions/:id/vocab/hard", (req, res) => res.json(storage.getHardWords(Number(req.params.id))));
  app.get("/api/sessions/:id/achievements", (req, res) => res.json(storage.getAchievements(Number(req.params.id))));
  app.get("/api/sessions/:id/topics/history", (req, res) => res.json(storage.getTopicHistory(Number(req.params.id))));

  app.post("/api/sessions", (req, res) => {
    const parsed = insertSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.json(storage.createSession(parsed.data));
  });

  // Profiles
  app.get("/api/profiles", (_req, res) => res.json(storage.getAllProfiles()));
  app.post("/api/profiles", (req, res) => {
    const { name, avatar, mode, telegramId } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    res.json(storage.createProfile({ name, avatar: avatar || "🧑", mode: mode || "adult", telegramId: telegramId || null }));
  });

  // Exercises — GET /api/sessions/:id/exercise?type=translate&lang=bg
  app.get("/api/sessions/:id/exercise", async (req, res) => {
    const id = Number(req.params.id);
    const session = storage.getSession(id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const type = (req.query.type as string) || "translate";
    const lang = (req.query.lang as "bg" | "en") || (session.language as "bg" | "en");

    if (!["translate", "cloze", "word_order"].includes(type)) {
      return res.status(400).json({ error: "type must be translate|cloze|word_order" });
    }

    try {
      const exercise = await generateExercise(id, type as any, lang, session.cefrLevel || "A1", (session.mode || "adult") as "adult" | "kid");
      res.json(exercise);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Submit exercise answer
  app.post("/api/sessions/:id/exercise/submit", (req, res) => {
    const id = Number(req.params.id);
    const session = storage.getSession(id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const { correct, perfectRun } = req.body;
    const xpAmount = correct ? (perfectRun ? XP.exercise_perfect : XP.exercise_correct) : 3;
    const updatedSession = storage.addXP(id, xpAmount);

    // Ачивка за упражнения
    const allAchievements = storage.getAchievements(id);
    const exerciseAchievements = allAchievements.filter(a => a.achievementId.startsWith("exercise"));
    if (exerciseAchievements.length >= 9) {
      storage.unlockAchievement(id, "exercise_10");
    }

    res.json({ xp: updatedSession.totalXP, dailyXP: updatedSession.dailyXP, streak: updatedSession.currentStreak });
  });

  // SM-2 review via REST
  app.post("/api/review", (req, res) => {
    const { cardId, quality } = req.body;
    if (typeof cardId !== "number" || typeof quality !== "number") return res.status(400).json({ error: "cardId and quality required" });
    const card = storage.getVocabCard(cardId);
    if (!card) return res.status(404).json({ error: "Card not found" });
    const result = sm2({ quality, repetitions: card.repetitions, easeFactor: card.easeFactor, interval: card.interval });
    const isWrong = quality < 3;
    const newFailStreak = isWrong ? (card.failStreak || 0) + 1 : 0;
    const isHard = newFailStreak >= 3 ? 1 : card.isHard;
    const updated = storage.updateVocabCard(cardId, { ...result, lastQuality: quality, failStreak: newFailStreak, isHard, nextReview: result.nextReview });
    res.json({ ...updated, nextReview: result.nextReview, interval: result.interval, isHard });
  });

  // Topics
  app.get("/api/topics", (req, res) => {
    const lang = (req.query.lang as "bg" | "en") || "bg";
    const kidMode = req.query.kid === "true";
    res.json(getTopicsForLanguage(lang, kidMode));
  });
  app.get("/api/topics/all", (_req, res) => res.json(ALL_TOPICS));
  app.get("/api/topics/categories", (_req, res) => res.json(TOPIC_CATEGORIES));

  // Scenarios
  app.get("/api/scenarios", (req, res) => {
    const lang = (req.query.lang as string) || "bg";
    if (lang !== "bg" && lang !== "en") return res.status(400).json({ error: "lang must be bg or en" });
    res.json(getScenariosForLanguage(lang));
  });
  app.get("/api/scenarios/all", (_req, res) => res.json(ALL_SCENARIOS));
  app.get("/api/levels", (_req, res) => res.json(LEVELS));
  app.get("/api/achievements/all", (_req, res) => res.json(ACHIEVEMENTS));
}
