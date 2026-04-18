/**
 * Уровни языка по стандарту CEFR (Common European Framework of Reference)
 * A1 → A2 → B1 → B2 (в MVP ограничиваемся до B2)
 *
 * Каждый уровень описывает:
 * - что умеет пользователь
 * - какая сложность у AI-репетитора
 * - сколько слов нужно знать (приблизительно)
 * - сколько очков нужно набрать чтобы перейти
 */

export type CEFRLevel = "A1" | "A2" | "B1" | "B2";

export interface LevelConfig {
  id: CEFRLevel;
  label: string;
  description: string;          // что умеет пользователь на этом уровне
  vocabTarget: number;           // целевое кол-во слов в словаре
  pointsToNext: number | null;   // очков для перехода на следующий уровень (null = финальный)
  aiInstructions: string;        // как AI должен говорить на этом уровне
}

export const LEVELS: Record<CEFRLevel, LevelConfig> = {
  A1: {
    id: "A1",
    label: "A1 — Начинающий",
    description: "Базовые приветствия, числа, цвета, простые вопросы",
    vocabTarget: 50,
    pointsToNext: 100,
    aiInstructions: `
- Используй ТОЛЬКО самые простые слова и короткие предложения (3-5 слов)
- Всегда давай транслитерацию: Здравей (Zdravey)
- После каждой фразы добавляй перевод на русский в скобках
- Хвали за любую попытку говорить
- Повторяй ключевые слова 2-3 раза в разных контекстах
- Темп речи: очень медленный
`.trim(),
  },
  A2: {
    id: "A2",
    label: "A2 — Элементарный",
    description: "Простые диалоги, покупки, знакомство, базовый транспорт",
    vocabTarget: 200,
    pointsToNext: 250,
    aiInstructions: `
- Простые предложения, но уже без постоянного перевода
- Транслитерацию давай только для новых слов
- Можешь задавать простые вопросы: «Как сказать по-болгарски...?»
- При ошибке поправляй коротко: «Лучше: [вариант]»
- Можешь использовать 1-2 новых слова за сообщение
`.trim(),
  },
  B1: {
    id: "B1",
    label: "B1 — Средний",
    description: "Свободная беседа на знакомые темы, простые рассказы",
    vocabTarget: 600,
    pointsToNext: 500,
    aiInstructions: `
- Веди полноценный диалог на болгарском/английском
- Транслитерация только по запросу
- Объясняй значение слов на целевом языке (не на русском)
- Используй более сложные грамматические конструкции
- Задавай открытые вопросы требующие развёрнутого ответа
- При ошибках объясни правило грамматики кратко
`.trim(),
  },
  B2: {
    id: "B2",
    label: "B2 — Выше среднего",
    description: "Уверенное общение, понимание большинства тем",
    vocabTarget: 1500,
    pointsToNext: null,
    aiInstructions: `
- Общайся как с практически свободно говорящим
- Используй идиомы и разговорные выражения
- Обсуждай абстрактные темы, новости, культуру
- Поправляй только существенные ошибки
- Предлагай более точные/естественные формулировки
`.trim(),
  },
};

export const LEVEL_ORDER: CEFRLevel[] = ["A1", "A2", "B1", "B2"];

export function getNextLevel(current: CEFRLevel): CEFRLevel | null {
  const idx = LEVEL_ORDER.indexOf(current);
  return idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}

export function getLevelProgress(vocabCount: number, level: CEFRLevel): number {
  const cfg = LEVELS[level];
  return Math.min(Math.round((vocabCount / cfg.vocabTarget) * 100), 100);
}
