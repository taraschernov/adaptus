import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, CheckCircle2, NotebookPen, RefreshCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ReviewWord = { word: string; translation: string; lang: "bg" | "en"; context?: string };
type ReviewImprovement = { mistake: string; fix: string; why: string };
type ReviewAlternative = { original: string; better: string };
type SessionReviewSummary = {
  strengths: string[];
  improvements: ReviewImprovement[];
  alternatives: ReviewAlternative[];
  nextDrill: string[];
  wordsForReview: ReviewWord[];
};

interface SessionReviewPageProps {
  sessionId: number | null;
}

export default function SessionReviewPage({ sessionId }: SessionReviewPageProps) {
  const qc = useQueryClient();

  const { data, isLoading, isRefetching, refetch } = useQuery<SessionReviewSummary>({
    queryKey: ["/api/sessions", sessionId, "review-summary"],
    queryFn: () =>
      sessionId
        ? apiRequest("GET", `/api/sessions/${sessionId}/review-summary`).then((r) => r.json() as Promise<SessionReviewSummary>)
        : Promise.resolve({
            strengths: ["Сначала начни диалог, затем открой разбор занятия."],
            improvements: [],
            alternatives: [],
            nextDrill: [],
            wordsForReview: [],
          }),
    enabled: !!sessionId,
  });

  const saveWords = useMutation({
    mutationFn: async () => {
      if (!sessionId || !data?.wordsForReview?.length) return { added: 0 };
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/review-summary/save-words`, {
        words: data.wordsForReview,
      });
      return res.json() as Promise<{ added: number }>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "vocab"] });
      qc.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "vocab", "due"] });
    },
  });

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/">
          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <NotebookPen size={18} className="text-primary" />
        <div className="flex-1">
          <h1 className="font-semibold text-sm leading-none">Разбор занятия</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Что получилось и что закрепить дальше</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading || isRefetching || !sessionId}>
          <RefreshCcw size={14} className="mr-1" />
          Обновить
        </Button>
      </header>

      <div className="flex-1 px-4 py-4 space-y-4">
        {isLoading && <div className="h-24 rounded-xl bg-muted animate-pulse" />}

        {!isLoading && data && (
          <>
            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={14} className="text-amber-500" />
                Что уже хорошо
              </h2>
              <ul className="mt-3 space-y-2">
                {data.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <CheckCircle2 size={14} className="text-teal-500 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Ключевые исправления</h2>
              <div className="mt-3 space-y-3">
                {data.improvements.length === 0 && <p className="text-sm text-muted-foreground">Серьёзных ошибок не найдено.</p>}
                {data.improvements.map((item, i) => (
                  <div key={i} className="rounded-lg border p-3 bg-muted/30">
                    <p className="text-xs text-muted-foreground">Было</p>
                    <p className="text-sm line-through decoration-red-400">{item.mistake}</p>
                    <p className="text-xs text-muted-foreground mt-2">Лучше так</p>
                    <p className="text-sm text-teal-700 dark:text-teal-400">{item.fix}</p>
                    <p className="text-xs text-muted-foreground mt-2">{item.why}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Более естественные фразы</h2>
              <div className="mt-3 space-y-3">
                {data.alternatives.length === 0 && <p className="text-sm text-muted-foreground">Пока нет предложений.</p>}
                {data.alternatives.map((item, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Твой вариант</p>
                    <p className="text-sm">{item.original}</p>
                    <p className="text-xs text-muted-foreground mt-2">Нативнее</p>
                    <p className="text-sm text-primary">{item.better}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Мини-дрилл на следующее занятие</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.nextDrill.length === 0 && <p className="text-sm text-muted-foreground">Сформируй диалог и обнови разбор.</p>}
                {data.nextDrill.map((line, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {line}
                  </Badge>
                ))}
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">Слова для повторения</h2>
                <Button
                  size="sm"
                  onClick={() => saveWords.mutate()}
                  disabled={!data.wordsForReview.length || saveWords.isPending || !sessionId}
                >
                  {saveWords.isPending ? "Сохраняю..." : "Добавить в SM-2"}
                </Button>
              </div>
              {saveWords.isSuccess && (
                <p className="text-xs text-teal-600 mt-2">Добавлено слов: {saveWords.data?.added ?? 0}</p>
              )}
              <div className="mt-3 space-y-2">
                {data.wordsForReview.length === 0 && <p className="text-sm text-muted-foreground">Новых слов для карточек пока нет.</p>}
                {data.wordsForReview.map((w, i) => (
                  <div key={i} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{w.word}</p>
                      <p className="text-xs text-muted-foreground">{w.translation}</p>
                      {w.context && <p className="text-xs text-muted-foreground/80 mt-1">«{w.context}»</p>}
                    </div>
                    <Badge variant="outline">{w.lang.toUpperCase()}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
