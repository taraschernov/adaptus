# AGENT.md — Инструкция для AI-агентов

> Этот файл описывает архитектуру, конвенции и правила работы с кодовой базой **Адаптус** для AI-агентов (Cursor, Copilot, Claude, Perplexity Computer и др.).

---

## Обзор проекта

**Адаптус** — fullstack web-приложение для изучения болгарского и английского языков.

- **Стек:** Node.js + Express + WebSocket (backend), React + Vite + Tailwind CSS + shadcn/ui (frontend), SQLite + Drizzle ORM (БД)
- **LLM:** Gemini 2.0 Flash (`gemini-2.0-flash`) через REST API
- **STT:** Deepgram Nova-3
- **TTS:** Google Cloud Neural2 (основной) / ElevenLabs Flash v2.5 (альтернатива)
- **Порт:** 5000 (dev и prod)
- **Роутинг:** Hash-routing (`useHashLocation` из wouter) — обязательно для Telegram iframe

---

## Критические ограничения

```
❌ НИКОГДА не используй localStorage, sessionStorage, indexedDB, cookies
   — заблокированы в Telegram iframe, приложение падает

❌ НИКОГДА не используй path-based routing без hash
   — сайт деплоится в iframe, все пути кроме / возвращают 404

❌ НИКОГДА не используй import.meta.env для секретов на фронтенде
   — API ключи только на сервере через process.env

✅ Всё состояние пользователя — через React state (в памяти) или SQLite (персистентно)
✅ Роутер всегда: <Router hook={useHashLocation}>
✅ Все HTTP запросы с фронтенда через apiRequest() из @/lib/queryClient
```

---

## Архитектура файлов

```
lang-tutor/
├── client/src/
│   ├── App.tsx                    # Router + глобальный state (mode, cefrLevel, sessionId, xp, streak)
│   ├── pages/
│   │   ├── tutor.tsx              # Главный чат — WebSocket, голос, XP, streak, детский режим
│   │   ├── exercises.tsx          # Упражнения — 3 типа, генерация через Gemini
│   │   ├── topics.tsx             # Topic Talk — выбор темы, свой топик
│   │   ├── scenarios.tsx          # Ролевые сценарии
│   │   ├── achievements.tsx       # Достижения — 16 штук, сетка 2 колонки
│   │   ├── vocab.tsx              # Словарь
│   │   ├── review.tsx             # SM-2 повторение карточек
│   │   └── settings.tsx           # TTS переключатель
│   └── hooks/
│       ├── useWebSocket.ts        # WS соединение, автореконнект
│       └── useVoiceRecorder.ts    # MediaRecorder API для записи голоса
├── server/
│   ├── routes.ts                  # ВСЯ бизнес-логика: WS handlers + REST endpoints
│   ├── storage.ts                 # SQLite через Drizzle — все CRUD операции
│   ├── tts.ts                     # TTS провайдеры: synthesize(text, lang, provider)
│   └── sm2.ts                     # SM-2 алгоритм: sm2({quality, repetitions, easeFactor, interval})
└── shared/
    ├── schema.ts                  # Drizzle схема — SOURCE OF TRUTH для типов
    ├── levels.ts                  # CEFR A1/A2/B1/B2 с aiInstructions и vocabTarget
    ├── scenarios.ts               # 12 ролевых сценариев (8 болгарских + 4 английских)
    ├── topics.ts                  # Темы для Topic Talk + детские темы
    └── achievements.ts            # 16 достижений с xpReward и kidTitle/kidDescription
```

---

## Схема базы данных (shared/schema.ts)

```typescript
// Ключевые таблицы:

sessions: {
  id, profileId, telegramId,
  language: "bg"|"en",
  cefrLevel: "A1"|"A2"|"B1"|"B2",
  activeScenario: string|null,       // ID сценария
  activeTopicId: string|null,        // ID темы
  activeTopicTitle: string|null,     // пользовательская тема
  mode: "adult"|"kid",
  currentStreak, longestStreak, totalXP, dailyXP, dailyGoalXP,
  lastActivityDate: "YYYY-MM-DD",
  streakFreezes: number,
  vocabCount: number
}

vocabCards: {
  id, sessionId, word, translation, context, language,
  imageEmoji,                        // для детского режима
  // SM-2 поля:
  repetitions, easeFactor, interval, nextReview, lastQuality,
  // Трудные слова:
  failStreak, isHard: 0|1
}

achievements: { id, sessionId, achievementId, unlockedAt }
profiles: { id, name, avatar, mode: "adult"|"kid", telegramId }
topicHistory: { sessionId, topicId, topicTitle, xpEarned, wordsLearned }
```

---

## WebSocket протокол

### Клиент → Сервер (string JSON)

```typescript
// Инициализация (первый вызов после connect)
{ type: "init", language: "bg"|"en", cefrLevel: "A1", mode: "adult"|"kid",
  telegramId?: string, ttsProvider?: string, activeScenario?: string }

// Сообщения
{ type: "text_message", text: string }
{ type: "audio_start", language: "bg"|"en" }
// затем бинарные чанки audio/webm
{ type: "audio_end" }

// Настройки сессии
{ type: "set_scenario", scenarioId: string|null }
{ type: "set_topic", topicId: string|null, topicTitle: string|null }
{ type: "set_cefr_level", level: "A1"|"A2"|"B1"|"B2" }
{ type: "switch_language", language: "bg"|"en" }
{ type: "switch_tts", provider: "google"|"elevenlabs" }
{ type: "set_mode", mode: "adult"|"kid" }

// SM-2
{ type: "review_card", cardId: number, quality: 0|1|2|3|4|5 }
```

### Сервер → Клиент

```typescript
{ type: "session", sessionId: number }
{ type: "thinking" }
{ type: "transcribing" }
{ type: "transcript", text: string }
{ type: "text_response",
    text: string,
    vocab: Array<{word, translation, lang, context?, emoji?}>,
    taskComplete?: boolean,           // true когда сценарий завершён
    xp: number, dailyXP: number, streak: number,
    newAchievements: Array<{id, title, emoji, xpReward}> }
{ type: "audio_response", audio: string }  // base64 mp3/wav
{ type: "card_reviewed", cardId, nextReview, interval, isHard }
{ type: "scenario_set", scenarioId }
{ type: "topic_set", topicId, topicTitle }
{ type: "cefr_level_set", level }
{ type: "error", message: string }
```

---

## REST API endpoints

```
GET  /api/health
GET  /api/sessions/:id
GET  /api/sessions/:id/messages
GET  /api/sessions/:id/vocab
GET  /api/sessions/:id/vocab/due          — SM-2 карточки к повторению сегодня
GET  /api/sessions/:id/vocab/hard         — isHard=1 карточки
GET  /api/sessions/:id/achievements
GET  /api/sessions/:id/topics/history

GET  /api/sessions/:id/exercise?type=translate|cloze|word_order&lang=bg|en
POST /api/sessions/:id/exercise/submit    { correct: bool, perfectRun: bool }
POST /api/sessions/:id/scenario           { scenarioId: string|null }
POST /api/sessions/:id/level              { level: "A1"|"A2"|"B1"|"B2" }
POST /api/sessions                        { ...InsertSession }

POST /api/review                          { cardId: number, quality: 0-5 }
GET  /api/scenarios?lang=bg|en
GET  /api/scenarios/all
GET  /api/topics?lang=bg|en&kid=true|false
GET  /api/topics/all
GET  /api/topics/categories
GET  /api/levels
GET  /api/achievements/all

GET  /api/profiles
POST /api/profiles                        { name, avatar, mode, telegramId }
```

---

## Системный промпт (buildSystemPrompt в routes.ts)

Функция `buildSystemPrompt(language, cefrLevel, scenarioId, topicId, topicTitle, mode, hardWords)`:

1. Базовый промпт под уровень из `LEVELS[cefrLevel].aiInstructions`
2. Если `mode === "kid"` — детский тон, эмодзи, простые слова
3. Если `hardWords.length > 0` — вплести эти слова в диалог
4. JSON-блок vocab в каждом ответе: `{"vocab": [{word, translation, lang, context, emoji}]}`
5. Если `scenarioId` — режим ролевой игры с `{"task_complete": true}` при завершении
6. Если `topicId/topicTitle` — режим "беседы по теме" с контекстом из `topics.ts`
7. Иначе — свободный чат

**Важно:** Ответ Gemini парсится regex'ом для извлечения JSON блоков. Любые изменения формата vocab или task_complete должны синхронизироваться с парсером в `callGemini()`.

---

## XP система

```typescript
const XP = {
  message: 5,          // текстовое сообщение
  voice: 8,            // голосовое сообщение
  exercise_correct: 10, // правильный ответ в упражнении
  exercise_perfect: 15, // правильный ответ (5+ подряд)
  topic_session: 20,   // беседа по теме
  scenario_complete: 30, // завершённый сценарий
  word_added: 2,       // новое слово в словарь
  hard_word: 5,        // трудное слово угадано
};
```

Streak: `storage.addXP(sessionId, amount)` автоматически обновляет streak через `checkAndUpdateStreak()`.

---

## Алгоритм трудных слов (Hard Words)

```typescript
// В review_card handler:
const newFailStreak = isWrong ? card.failStreak + 1 : 0;
const isHard = newFailStreak >= 3 ? 1 : card.isHard;
// isHard сбрасывается при правильном ответе после 3+ ошибок подряд
```

В системном промпте: `hardWords` = список `card.word` где `card.isHard === 1`.

---

## Генерация упражнений (generateExercise в routes.ts)

Вызывает Gemini с промптом под тип. Парсит JSON из ответа через regex `\{[\s\S]*\}`.

**Типы:**
- `translate` → `{type, word, correctAnswer, options[4], hint}`
- `cloze` → `{type, sentence (с ___), sentenceRu, correctAnswer, options[4]}`
- `word_order` → `{type, words[], correctOrder[], correctSentence, translation}`

Используются слова из словаря сессии (последние 20) как дистракторы/источник.

---

## Как добавить новый ролевой сценарий

1. Открой `shared/scenarios.ts`
2. Добавь объект `Scenario` в `BG_SCENARIOS` или `EN_SCENARIOS`:
```typescript
{
  id: "bg_hospital",
  lang: "bg",
  emoji: "🏥",
  title: "В больнице",
  setting: "Приёмный покой больницы в Ямболе",
  aiRole: "Дежурный врач",
  userRole: "Пациент с болью в животе",
  goal: "Описать симптомы, попросить помощь",
  level: ["A2", "B1"],
  successHints: ["боли ме", "имам температура", "от кога"],
}
```
3. Перезапусти сервер. REST `/api/scenarios?lang=bg` вернёт обновлённый список.

---

## Как добавить новую тему (Topic Talk)

1. Открой `shared/topics.ts`
2. Добавь объект `Topic` в `BG_TOPICS`, `EN_TOPICS` или `KIDS_TOPICS`:
```typescript
{
  id: "bg_architecture",
  lang: "bg", category: "culture",
  title: "Болгарская архитектура",
  emoji: "🏠", level: ["A2", "B1"],
  description: "Пловдивский старый город, возрожденческие дома",
  context: `Тема: болгарская архитектура. Ключевые слова: ...`,
  kidFriendly: false,
}
```

---

## Как добавить новое достижение

1. Открой `shared/achievements.ts`
2. Добавь объект `AchievementDef` в массив `ACHIEVEMENTS`
3. В `server/routes.ts` в функции `checkAndUnlockAchievements()` добавь логику проверки

---

## Drizzle ORM — важные особенности

SQLite-драйвер **синхронный**. Обязательные терминаторы:
```typescript
db.select().from(table).where(...).get()     // одна строка или undefined
db.select().from(table).all()                // массив
db.insert(table).values(data).returning().get()  // вставка с возвратом
db.update(table).set(data).where(...).run()  // UPDATE без возврата
```

НЕ деструктурировать: `const [row] = db.select()...` — **не работает**.

---

## Сборка и запуск

```bash
npm run dev          # dev режим (hot reload)
npm run build        # production сборка → dist/
NODE_ENV=production node dist/index.cjs   # prod запуск
```

---

## Переменные окружения

| Переменная | Обязательно | Описание |
|-----------|------------|---------|
| `GEMINI_API_KEY` | ✅ | Google AI Studio — LLM |
| `DEEPGRAM_API_KEY` | ⚠️ | STT (голос→текст). Без него голос недоступен |
| `GOOGLE_TTS_API_KEY` | ⚠️ | TTS (текст→голос). Google Neural2 |
| `ELEVENLABS_API_KEY` | ⚠️ | TTS альтернатива. ElevenLabs Flash v2.5 |

Без `DEEPGRAM_API_KEY` голосовой ввод недоступен, но текст работает.  
Без TTS ключей аудио-ответы недоступны, но текст работает.

---

## Типичные задачи для агента

**"Добавь новый тип упражнения — диктант":**
1. Добавь `dictation` в тип `ExerciseType` в `exercises.tsx`
2. Добавь промпт в `generateExercise()` в `routes.ts`
3. Добавь рендер кейса в компонент

**"Добавь RSS новости из Болгарии":**
1. `npm install rss-parser` (уже установлен)
2. В `routes.ts` добавь endpoint `GET /api/news?lang=bg`
3. Парси `https://bnr.bg/rss` или `https://news.bg/rss`
4. В `topics.tsx` добавь отдельную вкладку "Новости"

**"Добавь push-уведомления для streak":**
1. Нужен Telegram Bot API + Telegram.WebApp.sendNotification
2. Хранить chatId в `sessions.telegramId`
3. Cron-задача в server/index.ts — каждый день в 19:00

**"Переключить модель с Gemini на OpenAI":**
1. В `routes.ts` функция `callGemini()` — заменить fetch URL и формат body
2. OpenAI format: `messages: [{role: "system", content: systemPrompt}, ...history, {role: "user", content}]`

---

## Контекст проекта

Проект разрабатывается для личного использования:
- **Взрослый пользователь:** Тарас Чернов, живёт в Ямболе (Болгария), русскоязычный, изучает болгарский для жизни + английский для IT-работы
- **Детский пользователь:** сын, 6 класс болгарской школы, изучает английский для поступления в языковую гимназию
- **Целевые сценарии** (болгарский): аптека, муниципалитет, банк, нотариус, врач, рынок, такси, арендодатель
- **Целевые сценарии** (английский): IT job interview, переговоры, клиентские звонки, small talk
