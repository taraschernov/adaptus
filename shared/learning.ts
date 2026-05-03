export const LEARNING_FOCUS = ["conversation", "balanced", "grammar"] as const;

export type LearningFocus = typeof LEARNING_FOCUS[number];

export const LEARNING_FOCUS_LABELS: Record<LearningFocus, string> = {
  conversation: "Разговор",
  balanced: "Баланс",
  grammar: "Грамматика",
};
