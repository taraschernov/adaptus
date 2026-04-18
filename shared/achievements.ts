export interface AchievementDef {
  id: string;
  title: string;           // название
  description: string;     // описание
  emoji: string;           // иконка
  xpReward: number;        // XP за разблокировку
  kidTitle?: string;       // детская версия названия
  kidDescription?: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // Первые шаги
  {
    id: "first_word",
    title: "Первое слово",
    description: "Выучил первое слово в словарь",
    emoji: "🌱",
    xpReward: 10,
    kidTitle: "Первое слово!",
    kidDescription: "Ты выучил своё первое слово! Молодец!",
  },
  {
    id: "first_dialog",
    title: "Первый разговор",
    description: "Провёл первый диалог с AI-репетитором",
    emoji: "💬",
    xpReward: 15,
    kidTitle: "Поговорил с Адаптусом!",
    kidDescription: "Ты начал свой первый разговор!",
  },
  {
    id: "first_scenario",
    title: "В роли",
    description: "Прошёл первый ролевой сценарий",
    emoji: "🎭",
    xpReward: 20,
    kidTitle: "Актёр!",
    kidDescription: "Ты сыграл роль в первом сценарии!",
  },
  {
    id: "first_topic",
    title: "Любознательный",
    description: "Обсудил первую тему из Topic Talk",
    emoji: "🗺️",
    xpReward: 20,
    kidTitle: "Исследователь!",
    kidDescription: "Ты узнал что-то новое и интересное!",
  },

  // Словарный запас
  {
    id: "words_10",
    title: "Первый десяток",
    description: "Добавил 10 слов в словарь",
    emoji: "📝",
    xpReward: 20,
    kidTitle: "10 слов!",
    kidDescription: "Уже 10 новых слов в твоей копилке!",
  },
  {
    id: "words_50",
    title: "Копилка слов",
    description: "50 слов в словаре",
    emoji: "📚",
    xpReward: 50,
    kidTitle: "50 слов — ура!",
    kidDescription: "Целых 50 слов! Ты настоящий знаток!",
  },
  {
    id: "words_100",
    title: "Сотня!",
    description: "100 слов в словаре",
    emoji: "💯",
    xpReward: 100,
    kidTitle: "100 слов!",
    kidDescription: "100 слов — это просто СУПЕР!",
  },
  {
    id: "hard_word_broken",
    title: "Упрямое слово сломлено",
    description: "Выучил слово, которое давалось с трудом",
    emoji: "🔨",
    xpReward: 30,
    kidTitle: "Победил трудное слово!",
    kidDescription: "Это слово больше тебя не пугает!",
  },

  // Серии
  {
    id: "streak_3",
    title: "3 дня подряд",
    description: "Занимался 3 дня без перерыва",
    emoji: "🔥",
    xpReward: 30,
    kidTitle: "3 дня — огонь!",
    kidDescription: "Три дня подряд! Так держать!",
  },
  {
    id: "streak_7",
    title: "Неделя без остановки",
    description: "7 дней занятий подряд",
    emoji: "⚡",
    xpReward: 70,
    kidTitle: "Целая неделя!",
    kidDescription: "Целая неделя занятий! Ты настоящий чемпион!",
  },
  {
    id: "streak_30",
    title: "Месяц силы",
    description: "30 дней занятий подряд",
    emoji: "👑",
    xpReward: 300,
    kidTitle: "Целый месяц!",
    kidDescription: "30 дней занятий! Ты — КОРОЛЬ языков!",
  },

  // Упражнения
  {
    id: "exercise_10",
    title: "Спортсмен",
    description: "Выполнил 10 упражнений",
    emoji: "💪",
    xpReward: 25,
    kidTitle: "Силач!",
    kidDescription: "10 упражнений — ты тренируешься!",
  },
  {
    id: "exercise_perfect",
    title: "Без ошибок",
    description: "Прошёл 5 упражнений подряд без ошибок",
    emoji: "⭐",
    xpReward: 40,
    kidTitle: "Без ошибок!",
    kidDescription: "5 упражнений без единой ошибки! Звезда!",
  },

  // Уровни
  {
    id: "level_a2",
    title: "Уровень A2",
    description: "Достиг уровня A2",
    emoji: "🥈",
    xpReward: 100,
    kidTitle: "Уровень 2!",
    kidDescription: "Ты перешёл на новый уровень!",
  },
  {
    id: "level_b1",
    title: "Уровень B1",
    description: "Достиг уровня B1",
    emoji: "🥇",
    xpReward: 200,
    kidTitle: "Уровень 3!",
    kidDescription: "Уровень 3! Ты становишься настоящим мастером!",
  },
  {
    id: "level_b2",
    title: "Уровень B2",
    description: "Достиг уровня B2 — ты почти свободно говоришь!",
    emoji: "🏆",
    xpReward: 500,
    kidTitle: "Максимальный уровень!",
    kidDescription: "Максимальный уровень! Ты — мастер языка!",
  },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENTS.map(a => [a.id, a])
);

export type AchievementId = typeof ACHIEVEMENTS[number]["id"];
