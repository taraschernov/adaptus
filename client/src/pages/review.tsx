/**
 * Экран повторения слов по алгоритму SM-2
 *
 * Как это работает:
 * - Показывается слово на изучаемом языке
 * - Ты вспоминаешь перевод
 * - Открываешь ответ и оцениваешь насколько легко вспомнил (кнопки: Забыл / Трудно / Хорошо / Отлично)
 * - Алгоритм вычисляет, через сколько дней снова показать это слово
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Brain, Check, X, RotateCcw, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VocabCard } from "@shared/schema";

// SM-2 качество — кнопки для пользователя
const QUALITY_BUTTONS = [
  { quality: 0, label: "Забыл", description: "Вообще не помнил", color: "bg-red-500 hover:bg-red-600", icon: X },
  { quality: 2, label: "Трудно", description: "Вспомнил с трудом", color: "bg-amber-500 hover:bg-amber-600", icon: RotateCcw },
  { quality: 4, label: "Хорошо", description: "Вспомнил с паузой", color: "bg-indigo-500 hover:bg-indigo-600", icon: Check },
  { quality: 5, label: "Отлично", description: "Моментально", color: "bg-teal-600 hover:bg-teal-700", icon: Trophy },
];

interface ReviewPageProps {
  sessionId: number | null;
}

export default function ReviewPage({ sessionId }: ReviewPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [results, setResults] = useState<{ word: string; quality: number }[]>([]);

  const qc = useQueryClient();

  const { data: dueCards = [], isLoading } = useQuery<VocabCard[]>({
    queryKey: ["/api/sessions", sessionId, "vocab", "due"],
    queryFn: () => sessionId
      ? apiRequest("GET", `/api/sessions/${sessionId}/vocab/due`).then((res) => res.json() as Promise<VocabCard[]>)
      : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ cardId, quality }: { cardId: number; quality: number }) =>
      apiRequest("POST", "/api/review", { cardId, quality }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "vocab"] }),
  });

  const current = dueCards[currentIndex];

  const handleQuality = (quality: number) => {
    if (!current) return;
    reviewMutation.mutate({ cardId: current.id, quality });
    setResults(r => [...r, { word: current.word, quality }]);

    if (currentIndex + 1 >= dueCards.length) {
      setFinished(true);
    } else {
      setCurrentIndex(i => i + 1);
      setRevealed(false);
    }
  };

  const formatInterval = (card: VocabCard) => {
    if (card.interval <= 1) return "завтра";
    if (card.interval <= 7) return `через ${card.interval} дня`;
    if (card.interval <= 30) return `через ${card.interval} дней`;
    return `через ${Math.round(card.interval / 30)} мес.`;
  };

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/vocab">
          <button data-testid="btn-back" className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <Brain size={18} className="text-primary" />
        <h1 className="font-semibold text-sm">Повторение слов</h1>
        {!finished && dueCards.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {currentIndex + 1} / {dueCards.length}
          </Badge>
        )}
      </header>

      <div className="flex-1 px-4 py-6 flex flex-col items-center justify-center">

        {isLoading && (
          <div className="w-full max-w-sm h-48 rounded-2xl bg-muted animate-pulse" />
        )}

        {!isLoading && dueCards.length === 0 && (
          <div className="text-center py-8">
            <Trophy size={48} className="mx-auto mb-4 text-amber-500" />
            <h2 className="font-semibold text-lg">Всё повторено!</h2>
            <p className="text-sm text-muted-foreground mt-2">На сегодня повторений нет.</p>
            <p className="text-xs text-muted-foreground mt-1">Алгоритм напомнит когда нужно.</p>
            <Link href="/">
              <Button size="sm" className="mt-6" data-testid="btn-lesson">Продолжить урок</Button>
            </Link>
          </div>
        )}

        {!isLoading && finished && results.length > 0 && (
          <div className="text-center py-8 w-full max-w-sm">
            <Trophy size={48} className="mx-auto mb-4 text-amber-500" />
            <h2 className="font-semibold text-lg">Сессия завершена</h2>
            <div className="grid grid-cols-2 gap-3 mt-6">
              {[
                { label: "Отлично", count: results.filter(r => r.quality === 5).length, color: "text-teal-600" },
                { label: "Хорошо", count: results.filter(r => r.quality === 4).length, color: "text-indigo-600" },
                { label: "Трудно", count: results.filter(r => r.quality === 2).length, color: "text-amber-600" },
                { label: "Забыл", count: results.filter(r => r.quality === 0).length, color: "text-red-600" },
              ].map(s => (
                <div key={s.label} className="rounded-xl border bg-card p-3 text-center">
                  <p className={cn("text-2xl font-bold", s.color)}>{s.count}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-6 justify-center">
              <Button variant="outline" size="sm" onClick={() => { setCurrentIndex(0); setFinished(false); setResults([]); setRevealed(false); }}>
                <RotateCcw size={14} className="mr-1" />Ещё раз
              </Button>
              <Link href="/">
                <Button size="sm" data-testid="btn-lesson">К уроку</Button>
              </Link>
            </div>
          </div>
        )}

        {!isLoading && !finished && current && (
          <div className="w-full max-w-sm space-y-4">
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{ width: `${(currentIndex / dueCards.length) * 100}%` }}
              />
            </div>

            {/* Card */}
            <div
              className={cn(
                "rounded-2xl border p-8 text-center cursor-pointer transition-all select-none",
                "bg-card shadow-sm hover:shadow-md",
                !revealed && "hover:border-primary/50"
              )}
              onClick={() => !revealed && setRevealed(true)}
              data-testid="review-card"
            >
              <Badge variant="outline" className="mb-4 text-xs">
                {current.language === "bg" ? "🇧🇬 болгарский" : "🇬🇧 английский"}
              </Badge>

              <p className="text-3xl font-bold tracking-wide mb-2">{current.word}</p>

              {current.context && (
                <p className="text-xs text-muted-foreground italic mt-2 leading-relaxed">
                  «{current.context}»
                </p>
              )}

              {!revealed ? (
                <p className="text-sm text-muted-foreground mt-4">Нажми чтобы увидеть перевод</p>
              ) : (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xl font-semibold text-primary">{current.translation}</p>
                  {current.repetitions > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Повторений: {current.repetitions} · Следующее: {formatInterval(current)}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* SM-2 quality buttons */}
            {revealed && (
              <div className="space-y-2">
                <p className="text-xs text-center text-muted-foreground mb-3">Насколько легко вспомнил?</p>
                <div className="grid grid-cols-2 gap-2">
                  {QUALITY_BUTTONS.map(({ quality, label, description, color, icon: Icon }) => (
                    <button
                      key={quality}
                      data-testid={`quality-${quality}`}
                      onClick={() => handleQuality(quality)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-3 px-4 rounded-xl text-white font-medium transition-all",
                        color
                      )}
                    >
                      <Icon size={16} />
                      <span className="text-sm">{label}</span>
                      <span className="text-xs opacity-80">{description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
