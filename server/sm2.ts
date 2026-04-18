/**
 * SM-2 Spaced Repetition Algorithm
 * Автор оригинала: Piotr Woźniak (SuperMemo, 1987)
 * Используется в Anki, Duolingo, Memrise
 *
 * Идея проста: ты оцениваешь насколько легко вспомнил слово (0–5),
 * алгоритм вычисляет через сколько дней снова показать это слово.
 * Хорошо запомненные слова показываются реже (через месяц, потом через 3 месяца).
 * Трудные слова показываются часто (завтра, послезавтра).
 */

export interface SM2Input {
  quality: number;       // 0–5: насколько легко вспомнил (5=отлично, 0=полный провал)
  repetitions: number;   // сколько раз подряд вспомнил правильно
  easeFactor: number;    // коэффициент лёгкости (начальное значение 2.5)
  interval: number;      // текущий интервал в днях
}

export interface SM2Output {
  repetitions: number;
  easeFactor: number;
  interval: number;       // дней до следующего повтора
  nextReview: Date;
}

export function sm2(input: SM2Input): SM2Output {
  const { quality, repetitions, easeFactor, interval } = input;

  let newRepetitions: number;
  let newEaseFactor: number;
  let newInterval: number;

  if (quality >= 3) {
    // Вспомнил правильно
    if (repetitions === 0) {
      newInterval = 1;        // первый раз — через 1 день
    } else if (repetitions === 1) {
      newInterval = 6;        // второй раз — через 6 дней
    } else {
      newInterval = Math.round(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
  } else {
    // Ошибся — начинаем сначала
    newRepetitions = 0;
    newInterval = 1;
  }

  // Пересчёт коэффициента лёгкости
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEaseFactor < 1.3) newEaseFactor = 1.3; // минимум 1.3

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    interval: newInterval,
    nextReview,
  };
}

/**
 * Получить карточки, которые нужно повторить сегодня
 */
export function isDueToday(nextReview: Date | null): boolean {
  if (!nextReview) return true;
  return new Date() >= nextReview;
}
