# Адаптус (Adaptus) — AI Language Tutor

> Персональный AI-репетитор болгарского и английского языков с голосовым вводом, ролевыми сценариями, упражнениями и геймификацией. Работает в браузере и как Telegram Mini App.

![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Stack](https://img.shields.io/badge/stack-Node.js%20%2B%20React%20%2B%20SQLite-orange)

---

## Что умеет

- 🗣️ **Голосовой диалог** — говоришь по-болгарски/английски, AI отвечает голосом
- 🎭 **Ролевые сценарии** — 12 реальных ситуаций: аптека, такси, арендодатель, банк, нотариус...
- 🗺️ **Беседа по теме** — история Болгарии, новости, культура, IT, своя тема
- 📝 **Упражнения** — переведи слово, заполни пропуск, составь предложение
- 📚 **Словарь со SM-2** — умные карточки с оптимальными интервалами повторения
- 🏆 **16 достижений** и геймификация (XP, Streak, дневная цель)
- 👶 **Детский режим** — упрощённый интерфейс с эмодзи для детей
- 🔥 **Streak** — серия дней с заморозкой на пропуск
- 📊 **CEFR уровни** A1→B2 с прогресс-баром

---

## Быстрый старт

### 1. Клонировать и установить зависимости

```bash
git clone https://github.com/taraschernov/adaptus.git
cd adaptus
npm install
```

### 2. Настроить переменные окружения

```bash
cp .env.example .env
```

Открой `.env` и заполни:

```env
# ОБЯЗАТЕЛЬНО — AI (бесплатный)
GEMINI_API_KEY=your_key_here

# ОПЦИОНАЛЬНО — Голосовой ввод (STT)
DEEPGRAM_API_KEY=your_key_here

# ОПЦИОНАЛЬНО — TTS (одно из двух или оба)
GOOGLE_TTS_API_KEY=your_key_here     # бесплатно 1M символов/мес
ELEVENLABS_API_KEY=your_key_here     # бесплатно 20k символов/мес
```

**Как получить ключи бесплатно:**
- `GEMINI_API_KEY` → [aistudio.google.com](https://aistudio.google.com) → Get API Key
- `DEEPGRAM_API_KEY` → [deepgram.com](https://deepgram.com) → Free tier 200$/мес
- `GOOGLE_TTS_API_KEY` → [console.cloud.google.com](https://console.cloud.google.com) → Text-to-Speech API
- `ELEVENLABS_API_KEY` → [elevenlabs.io](https://try.elevenlabs.io/06l31u7a522u) → Free plan

### 3. Запустить

```bash
npm run dev
```

Открой [http://localhost:5000](http://localhost:5000)

---

## Деплой

### Railway (рекомендуется)

```bash
railway login
railway init
railway up
```

Добавь переменные окружения в Railway Dashboard → Variables.

### Render

Нажми кнопку:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

Конфиг уже есть в `render.yaml`.

### Docker

```bash
docker build -t adaptus .
docker run -p 5000:5000 --env-file .env adaptus
```

---

## Telegram Mini App

Приложение полностью совместимо с Telegram Mini Apps:

1. Создай бота через [@BotFather](https://t.me/BotFather)
2. Настрой Web App URL: `/newapp` → укажи URL задеплоенного приложения
3. SDK уже подключён в `client/index.html`
4. Telegram ID пользователя передаётся автоматически

---

## Технологии

| Компонент | Технология | Бесплатно |
|-----------|-----------|-----------|
| Backend | Node.js + Express + WebSocket | ✅ |
| Frontend | React + Vite + Tailwind + shadcn/ui | ✅ |
| AI (LLM) | Gemini 2.0 Flash | ✅ |
| STT (голос→текст) | Deepgram Nova-3 | ✅ |
| TTS (текст→голос) | Google Cloud Neural2 | ✅ |
| TTS альтернатива | ElevenLabs Flash v2.5 | ✅ |
| База данных | SQLite + Drizzle ORM | ✅ |
| Алгоритм повторений | SM-2 (SuperMemo) | ✅ |

---

## Структура проекта

```
adaptus/
├── client/                   # React фронтенд
│   └── src/
│       ├── pages/
│       │   ├── tutor.tsx       # Главный чат (голос + текст)
│       │   ├── exercises.tsx   # Упражнения (3 типа)
│       │   ├── topics.tsx      # Topic Talk — беседа по теме
│       │   ├── scenarios.tsx   # Ролевые сценарии
│       │   ├── achievements.tsx # Достижения
│       │   ├── vocab.tsx       # Словарь
│       │   └── review.tsx      # SM-2 повторение
│       └── App.tsx
├── server/
│   ├── routes.ts             # WebSocket + REST API
│   ├── storage.ts            # SQLite + Drizzle
│   ├── tts.ts                # TTS провайдеры (Google/ElevenLabs)
│   └── sm2.ts                # SM-2 алгоритм
├── shared/
│   ├── schema.ts             # Drizzle схема БД
│   ├── levels.ts             # CEFR A1-B2 конфиг
│   ├── scenarios.ts          # 12 ролевых сценариев
│   ├── topics.ts             # Темы для Topic Talk
│   └── achievements.ts       # 16 достижений
├── Dockerfile
├── railway.json
├── render.yaml
└── .env.example
```

---

## WebSocket протокол

Приложение использует WebSocket для real-time общения:

**Клиент → Сервер:**
```json
{ "type": "init", "language": "bg", "cefrLevel": "A1", "mode": "adult" }
{ "type": "text_message", "text": "Здравей" }
{ "type": "audio_start", "language": "bg" }
{ "type": "audio_end" }
{ "type": "set_scenario", "scenarioId": "bg_pharmacy" }
{ "type": "set_topic", "topicId": "bg_cyril_method" }
{ "type": "set_cefr_level", "level": "A2" }
{ "type": "review_card", "cardId": 1, "quality": 4 }
```

**Сервер → Клиент:**
```json
{ "type": "session", "sessionId": 1 }
{ "type": "text_response", "text": "...", "vocab": [...], "xp": 50, "streak": 3 }
{ "type": "audio_response", "audio": "base64..." }
{ "type": "card_reviewed", "cardId": 1, "nextReview": "...", "interval": 6 }
```

---

## REST API

```
GET  /api/health                          — статус сервера
GET  /api/sessions/:id                    — данные сессии
GET  /api/sessions/:id/vocab              — все слова
GET  /api/sessions/:id/vocab/due          — слова к повторению
GET  /api/sessions/:id/vocab/hard         — трудные слова
GET  /api/sessions/:id/achievements       — достижения
POST /api/sessions/:id/exercise/submit    — сдать упражнение
GET  /api/sessions/:id/exercise?type=translate&lang=bg  — получить упражнение
GET  /api/scenarios?lang=bg              — список сценариев
GET  /api/topics?lang=bg                 — список тем
GET  /api/levels                         — CEFR уровни
GET  /api/achievements/all               — все достижения
POST /api/review                         — SM-2 оценить карточку
```

---

## Разработка для конкретного языка

Приложение изначально создано для изучения **болгарского языка** русскоязычными пользователями (expat в Болгарии). Отдельный акцент — реальные ситуации из жизни в Болгарии:

- Запись к врачу, аптека, муниципалитет
- Аренда квартиры, разговор с арендодателем
- Банк, нотариус, регистрация адреса

---

## Лицензия

MIT — используй, модифицируй, деплой для себя.
