import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, CheckCircle, XCircle, RefreshCw, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type ExerciseType = "translate" | "cloze" | "word_order";
type ExerciseState = "loading" | "active" | "correct" | "wrong" | "finished";

interface TranslateExercise {
  type: "translate";
  word: string;
  correctAnswer: string;
  options: string[];
  hint?: string;
}
interface ClozeExercise {
  type: "cloze";
  sentence: string;
  sentenceRu: string;
  correctAnswer: string;
  options: string[];
}
interface WordOrderExercise {
  type: "word_order";
  words: string[];
  correctOrder: number[];
  correctSentence: string;
  translation: string;
}
type Exercise = TranslateExercise | ClozeExercise | WordOrderExercise;

const TYPE_LABELS: Record<ExerciseType, { label: string; emoji: string; desc: string }> = {
  translate: { label: "Переведи слово", emoji: "🔤", desc: "Выбери правильный перевод" },
  cloze: { label: "Заполни пропуск", emoji: "📝", desc: "Выбери нужное слово" },
  word_order: { label: "Составь предложение", emoji: "🧩", desc: "Расставь слова по порядку" },
};

interface ExercisePageProps {
  sessionId: number | null;
  language: "bg" | "en";
  mode?: "adult" | "kid";
  onXPGained?: (xp: number) => void;
}

export default function ExercisesPage({ sessionId, language, mode = "adult", onXPGained }: ExercisePageProps) {
  const [exerciseType, setExerciseType] = useState<ExerciseType>("translate");
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [state, setState] = useState<ExerciseState>("loading");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [wordOrderSelected, setWordOrderSelected] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [total, setTotal] = useState(0);
  const [perfectStreak, setPerfectStreak] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [showXPFlash, setShowXPFlash] = useState(false);

  const isKid = mode === "kid";

  const loadExercise = useCallback(async () => {
    if (!sessionId) return;
    setState("loading");
    setSelectedAnswer(null);
    setWordOrderSelected([]);
    try {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}/exercise?type=${exerciseType}&lang=${language}`);
      const data = await res.json();
      setExercise(data);
      setState("active");
    } catch {
      setState("loading");
    }
  }, [sessionId, exerciseType, language]);

  useEffect(() => { loadExercise(); }, [exerciseType]);

  const submitAnswer = async (answer: string) => {
    if (!exercise || state !== "active" || !sessionId) return;

    const isCorrect = answer.toLowerCase().trim() === (
      exercise.type === "word_order"
        ? (exercise as WordOrderExercise).correctSentence.toLowerCase()
        : (exercise as TranslateExercise | ClozeExercise).correctAnswer.toLowerCase()
    );

    setSelectedAnswer(answer);
    setState(isCorrect ? "correct" : "wrong");

    const newPerfect = isCorrect ? perfectStreak + 1 : 0;
    setPerfectStreak(newPerfect);
    if (isCorrect) setScore(s => s + 1);
    setTotal(t => t + 1);

    // Submit to backend for XP
    try {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/exercise/submit`, {
        correct: isCorrect,
        perfectRun: newPerfect >= 5,
      });
      const data = await res.json();
      const gained = isCorrect ? (newPerfect >= 5 ? 15 : 10) : 3;
      setXpGained(gained);
      setShowXPFlash(true);
      onXPGained?.(data.xp);
      setTimeout(() => setShowXPFlash(false), 1500);
    } catch {}
  };

  const handleWordOrderTap = (wordIndex: number) => {
    if (state !== "active") return;
    if (wordOrderSelected.includes(wordIndex)) {
      setWordOrderSelected(prev => prev.filter(i => i !== wordIndex));
    } else {
      const newSelected = [...wordOrderSelected, wordIndex];
      setWordOrderSelected(newSelected);
      if (exercise && newSelected.length === (exercise as WordOrderExercise).words.length) {
        const sentence = newSelected.map(i => (exercise as WordOrderExercise).words[i]).join(" ");
        submitAnswer(sentence);
      }
    }
  };

  const kidPraise = ["Отлично! 🌟", "Молодец! ⭐", "Супер! 🎉", "Правильно! 🎮", "Ты звезда! ✨"];
  const randomPraise = kidPraise[Math.floor(Math.random() * kidPraise.length)];

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/">
          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className={cn("font-semibold leading-none", isKid ? "text-base" : "text-sm")}>
            {isKid ? "🎮 Тренировка" : "Упражнения"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isKid ? "Учись играючи!" : TYPE_LABELS[exerciseType].desc}
          </p>
        </div>
        {/* Score */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-primary font-semibold">{score}✓</span>
          <span className="text-muted-foreground">{total}</span>
          {perfectStreak >= 3 && <span className="text-amber-500">🔥{perfectStreak}</span>}
        </div>
      </header>

      {/* Type selector */}
      <div className="flex gap-2 px-4 py-3 border-b bg-card overflow-x-auto">
        {(Object.keys(TYPE_LABELS) as ExerciseType[]).map(t => (
          <button
            key={t}
            data-testid={`type-${t}`}
            onClick={() => setExerciseType(t)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
              exerciseType === t
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            <span>{TYPE_LABELS[t].emoji}</span>
            <span>{TYPE_LABELS[t].label}</span>
          </button>
        ))}
      </div>

      {/* Exercise area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* XP flash */}
        {showXPFlash && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-amber-300 text-amber-900 font-bold px-4 py-2 rounded-full shadow-lg animate-bounce">
            +{xpGained} XP ⚡
          </div>
        )}

        {state === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-muted animate-pulse" />
            <p className="text-muted-foreground text-sm">Генерирую упражнение...</p>
          </div>
        )}

        {state !== "loading" && exercise && (
          <>
            {/* Exercise card */}
            <div className={cn(
              "w-full rounded-2xl p-6 shadow-sm border-2 transition-colors bg-card/90",
              state === "correct" ? "border-teal-400 bg-teal-50 dark:bg-teal-950/30" :
              state === "wrong" ? "border-red-400 bg-red-50 dark:bg-red-950/30" :
              "border-border bg-card"
            )}>
              {/* Translate */}
              {exercise.type === "translate" && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">Как переводится?</p>
                  <p className={cn("font-bold mb-1", isKid ? "text-3xl" : "text-2xl")}>{exercise.word}</p>
                  {exercise.hint && <p className="text-xs text-muted-foreground">{exercise.hint}</p>}
                </div>
              )}
              {/* Cloze */}
              {exercise.type === "cloze" && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">Заполни пропуск:</p>
                  <p className={cn("font-medium mb-2", isKid ? "text-lg" : "text-base")}>
                    {exercise.sentence.replace("___", "______")}
                  </p>
                  <p className="text-xs text-muted-foreground italic">{exercise.sentenceRu}</p>
                </div>
              )}
              {/* Word order */}
              {exercise.type === "word_order" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-3 text-center">Составь предложение:</p>
                  {/* Selected words */}
                  <div className="min-h-10 flex flex-wrap gap-2 mb-4 p-3 bg-muted/50 rounded-xl">
                    {wordOrderSelected.map((idx, pos) => (
                      <button
                        key={`sel-${idx}`}
                        onClick={() => state === "active" && setWordOrderSelected(prev => prev.filter(i => i !== idx))}
                        className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                      >
                        {exercise.words[idx]}
                      </button>
                    ))}
                    {wordOrderSelected.length === 0 && (
                      <p className="text-xs text-muted-foreground self-center">Нажимай на слова ↓</p>
                    )}
                  </div>
                  {/* Available words */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {exercise.words.map((word, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleWordOrderTap(idx)}
                        disabled={wordOrderSelected.includes(idx) || state !== "active"}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all",
                          wordOrderSelected.includes(idx)
                            ? "opacity-30 border-muted bg-muted"
                            : "border-border bg-card hover:border-primary"
                        )}
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3 italic">{exercise.translation}</p>
                </div>
              )}
            </div>

            {/* Options (translate & cloze) */}
            {(exercise.type === "translate" || exercise.type === "cloze") && (
              <div className="w-full grid grid-cols-2 gap-3">
                {exercise.options.map((opt, i) => {
                  const isSelected = selectedAnswer === opt;
                  const isCorrectOpt = opt.toLowerCase() === exercise.correctAnswer.toLowerCase();
                  let btnClass = "border-border bg-card text-foreground";
                  if (state !== "active" && isCorrectOpt) btnClass = "border-teal-500 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300";
                  else if (isSelected && state === "wrong") btnClass = "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700";

                  return (
                    <button
                      key={i}
                      data-testid={`option-${i}`}
                      onClick={() => state === "active" && submitAnswer(opt)}
                      disabled={state !== "active"}
                      className={cn(
                        "p-3 rounded-xl border-2 text-sm font-medium text-center transition-all",
                        btnClass,
                        state === "active" && "hover:border-primary active:scale-95"
                      )}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Feedback */}
            {(state === "correct" || state === "wrong") && (
              <div className={cn(
                "w-full flex items-center gap-3 p-4 rounded-xl",
                state === "correct" ? "bg-teal-100 dark:bg-teal-950/40" : "bg-red-100 dark:bg-red-950/40"
              )}>
                {state === "correct"
                  ? <CheckCircle className="text-teal-600 shrink-0" size={24} />
                  : <XCircle className="text-red-500 shrink-0" size={24} />
                }
                <div className="flex-1">
                  <p className={cn("font-semibold text-sm", state === "correct" ? "text-teal-700 dark:text-teal-300" : "text-red-600")}>
                    {state === "correct"
                      ? (isKid ? randomPraise : "Правильно! +10 XP")
                      : (isKid ? "Почти! Попробуй ещё 💪" : "Неправильно")}
                  </p>
                  {state === "wrong" && exercise.type !== "word_order" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Правильный ответ: {(exercise as TranslateExercise | ClozeExercise).correctAnswer}
                    </p>
                  )}
                  {state === "wrong" && exercise.type === "word_order" && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Правильно: {(exercise as WordOrderExercise).correctSentence}
                    </p>
                  )}
                </div>
                <Button size="sm" onClick={loadExercise} className="shrink-0">
                  {isKid ? "Дальше! →" : "Следующее"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          {isKid ? "💡 За каждый правильный ответ ты получаешь звёздочки!" : "Правильный ответ = 10 XP • Ошибка = 3 XP"}
        </p>
      </div>
    </div>
  );
}
