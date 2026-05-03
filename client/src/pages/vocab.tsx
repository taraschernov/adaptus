import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VocabCard } from "@shared/schema";

interface VocabPageProps {
  sessionId: number | null;
}

function formatNextReview(nextReview: Date | string | null): string {
  if (!nextReview) return "сейчас";
  const d = new Date(nextReview);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (diffDays <= 0) return "сейчас";
  if (diffDays === 1) return "завтра";
  if (diffDays < 7) return `через ${diffDays} дня`;
  if (diffDays < 30) return `через ${diffDays} дней`;
  return `через ${Math.round(diffDays / 30)} мес.`;
}

function getStrengthColor(repetitions: number): string {
  if (repetitions === 0) return "bg-red-400";
  if (repetitions < 3) return "bg-amber-400";
  if (repetitions < 6) return "bg-indigo-400";
  return "bg-teal-500";
}

export default function VocabPage({ sessionId }: VocabPageProps) {

  const { data: cards = [], isLoading } = useQuery<VocabCard[]>({
    queryKey: ["/api/sessions", sessionId, "vocab"],
    queryFn: () =>
      sessionId
        ? apiRequest("GET", `/api/sessions/${sessionId}/vocab`).then((res) => res.json() as Promise<VocabCard[]>)
        : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const { data: dueCards = [] } = useQuery<VocabCard[]>({
    queryKey: ["/api/sessions", sessionId, "vocab", "due"],
    queryFn: () =>
      sessionId
        ? apiRequest("GET", `/api/sessions/${sessionId}/vocab/due`).then((res) => res.json() as Promise<VocabCard[]>)
        : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const bgCards = cards.filter(c => c.language === "bg");
  const enCards = cards.filter(c => c.language === "en");

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/">
          <button data-testid="btn-back" className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <BookOpen size={18} className="text-primary" />
        <h1 className="font-semibold text-sm">Словарь</h1>
        <Badge variant="secondary" className="ml-auto">{cards.length} слов</Badge>
      </header>

      <div className="flex-1 px-4 py-4 space-y-5">

        {/* Repeat button */}
        {dueCards.length > 0 && (
          <Link href="/review">
            <button data-testid="btn-review" className="w-full flex items-center gap-3 p-4 rounded-xl bg-primary text-primary-foreground">
              <Brain size={20} />
              <div className="text-left">
                <p className="font-semibold text-sm">Повторить слова</p>
                <p className="text-xs opacity-80">{dueCards.length} слов ждут повторения сегодня</p>
              </div>
            </button>
          </Link>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
          </div>
        )}

        {!isLoading && cards.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Слова появятся автоматически в ходе уроков.</p>
            <Link href="/">
              <Button size="sm" className="mt-4" data-testid="btn-start-lesson">Начать урок</Button>
            </Link>
          </div>
        )}

        {bgCards.length > 0 && (
          <Section title="🇧🇬 Болгарский" cards={bgCards} formatNextReview={formatNextReview} getStrengthColor={getStrengthColor} />
        )}
        {enCards.length > 0 && (
          <Section title="🇬🇧 Английский" cards={enCards} formatNextReview={formatNextReview} getStrengthColor={getStrengthColor} />
        )}
      </div>
    </div>
  );
}

function Section({ title, cards, formatNextReview, getStrengthColor }: {
  title: string;
  cards: VocabCard[];
  formatNextReview: (d: Date | string | null) => string;
  getStrengthColor: (r: number) => string;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {cards.map(card => (
          <div key={card.id} data-testid={`vocab-card-${card.id}`} className="vocab-card rounded-xl p-3">
            <p className="font-semibold text-sm text-foreground">{card.word}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{card.translation}</p>
            {card.context && (
              <p className="text-xs text-muted-foreground/60 mt-1 italic truncate">«{card.context}»</p>
            )}
            <div className="flex items-center gap-1.5 mt-2">
              <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getStrengthColor(card.repetitions))} />
              <div className="flex-1 h-1 rounded bg-border">
                <div
                  className={cn("h-1 rounded transition-all", getStrengthColor(card.repetitions))}
                  style={{ width: `${Math.min(card.repetitions * 15, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{formatNextReview(card.nextReview)}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
