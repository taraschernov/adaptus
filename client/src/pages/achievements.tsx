import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, ChevronDown, ChevronUp, Lock, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { AchievementDef } from "@shared/achievements";
import { ACHIEVEMENTS } from "@shared/achievements";

interface AchievementsPageProps {
  sessionId: number | null;
  mode?: "adult" | "kid";
  totalXP?: number;
  streak?: number;
}

type FilterKey = "all" | "unlocked" | "in_progress" | "locked";
type TierKey = "Bronze" | "Silver" | "Gold" | "Platinum";
type CategoryKey = "consistency" | "vocabulary" | "practice" | "milestones";
type AchievementStatus = "Unlocked" | "In Progress" | "Locked";

interface SessionState {
  totalXP: number;
  currentStreak: number;
  vocabCount: number;
  cefrLevel: string;
}

interface AchievementCardModel {
  def: AchievementDef;
  tier: TierKey;
  category: CategoryKey;
  status: AchievementStatus;
  progress: number;
  progressText: string;
}

const CATEGORY_META: Record<CategoryKey, { title: string; subtitle: string }> = {
  consistency: { title: "Consistency", subtitle: "Daily streak and habit momentum" },
  vocabulary: { title: "Vocabulary", subtitle: "Words learned and retained" },
  practice: { title: "Practice", subtitle: "Exercises, dialogs, and scenarios" },
  milestones: { title: "Milestones", subtitle: "Level breakthroughs and major wins" },
};

const FILTERS: Array<{ id: FilterKey; label: string }> = [
  { id: "all", label: "All" },
  { id: "unlocked", label: "Unlocked" },
  { id: "in_progress", label: "In Progress" },
  { id: "locked", label: "Locked" },
];

const CEFR_ORDER = ["A1", "A2", "B1", "B2"] as const;

function toTier(points: number): TierKey {
  if (points >= 300) return "Platinum";
  if (points >= 120) return "Gold";
  if (points >= 50) return "Silver";
  return "Bronze";
}

function toCategory(id: string): CategoryKey {
  if (id.startsWith("streak_")) return "consistency";
  if (id.startsWith("words_") || id === "first_word" || id === "hard_word_broken") return "vocabulary";
  if (id.startsWith("exercise_") || id.includes("dialog") || id.includes("scenario") || id.includes("topic")) return "practice";
  return "milestones";
}

function normalizeProgress(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function progressForAchievement(def: AchievementDef, state: SessionState | undefined, unlocked: boolean): { progress: number; text: string } {
  if (!state) {
    return unlocked ? { progress: 100, text: "Completed" } : { progress: 0, text: "Start practicing" };
  }

  const vocab = Math.max(0, state.vocabCount || 0);
  const streak = Math.max(0, state.currentStreak || 0);
  const levelIndex = CEFR_ORDER.indexOf((state.cefrLevel || "A1") as (typeof CEFR_ORDER)[number]);

  switch (def.id) {
    case "first_word":
      return { progress: normalizeProgress(vocab * 100), text: `${Math.min(vocab, 1)}/1` };
    case "words_10":
      return { progress: normalizeProgress((vocab / 10) * 100), text: `${Math.min(vocab, 10)}/10` };
    case "words_50":
      return { progress: normalizeProgress((vocab / 50) * 100), text: `${Math.min(vocab, 50)}/50` };
    case "words_100":
      return { progress: normalizeProgress((vocab / 100) * 100), text: `${Math.min(vocab, 100)}/100` };
    case "streak_3":
      return { progress: normalizeProgress((streak / 3) * 100), text: `${Math.min(streak, 3)}/3 days` };
    case "streak_7":
      return { progress: normalizeProgress((streak / 7) * 100), text: `${Math.min(streak, 7)}/7 days` };
    case "streak_30":
      return { progress: normalizeProgress((streak / 30) * 100), text: `${Math.min(streak, 30)}/30 days` };
    case "level_a2": {
      const target = CEFR_ORDER.indexOf("A2");
      const progress = target <= 0 ? 100 : normalizeProgress((Math.max(levelIndex, 0) / target) * 100);
      return { progress, text: `Current: ${state.cefrLevel}` };
    }
    case "level_b1": {
      const target = CEFR_ORDER.indexOf("B1");
      const progress = target <= 0 ? 100 : normalizeProgress((Math.max(levelIndex, 0) / target) * 100);
      return { progress, text: `Current: ${state.cefrLevel}` };
    }
    case "level_b2": {
      const target = CEFR_ORDER.indexOf("B2");
      const progress = target <= 0 ? 100 : normalizeProgress((Math.max(levelIndex, 0) / target) * 100);
      return { progress, text: `Current: ${state.cefrLevel}` };
    }
    default:
      return unlocked ? { progress: 100, text: "Completed" } : { progress: 0, text: "Locked" };
  }
}

function statusFromProgress(unlocked: boolean, progress: number): AchievementStatus {
  if (unlocked || progress >= 100) return "Unlocked";
  if (progress > 0) return "In Progress";
  return "Locked";
}

export default function AchievementsPage({ sessionId, mode = "adult", totalXP = 0, streak = 0 }: AchievementsPageProps) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [expanded, setExpanded] = useState<Record<CategoryKey, boolean>>({
    consistency: true,
    vocabulary: true,
    practice: true,
    milestones: true,
  });

  const isKid = mode === "kid";

  const { data: unlocked = [] } = useQuery<Array<{ achievementId: string }>>({
    queryKey: ["/api/sessions", sessionId, "achievements"],
    queryFn: () => (sessionId ? apiRequest("GET", `/api/sessions/${sessionId}/achievements`).then((r) => r.json()) : Promise.resolve([])),
    enabled: !!sessionId,
  });

  const { data: session } = useQuery<SessionState | null>({
    queryKey: ["/api/sessions", sessionId],
    queryFn: () => (sessionId ? apiRequest("GET", `/api/sessions/${sessionId}`).then((r) => r.json()) : Promise.resolve(null)),
    enabled: !!sessionId,
  });

  const sessionStats = session ?? {
    totalXP,
    currentStreak: streak,
    vocabCount: 0,
    cefrLevel: "A1",
  };

  const unlockedIds = useMemo(() => new Set(unlocked.map((item) => item.achievementId)), [unlocked]);

  const cards = useMemo<AchievementCardModel[]>(() => {
    return ACHIEVEMENTS.map((def) => {
      const unlockedNow = unlockedIds.has(def.id);
      const { progress, text } = progressForAchievement(def, sessionStats, unlockedNow);
      return {
        def,
        tier: toTier(def.xpReward),
        category: toCategory(def.id),
        status: statusFromProgress(unlockedNow, progress),
        progress: unlockedNow ? 100 : progress,
        progressText: unlockedNow ? "Completed" : text,
      };
    });
  }, [sessionStats, unlockedIds]);

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "unlocked") return card.status === "Unlocked";
      if (activeFilter === "in_progress") return card.status === "In Progress";
      return card.status === "Locked";
    });
  }, [cards, activeFilter]);

  const grouped = useMemo(() => {
    return filteredCards.reduce<Record<CategoryKey, AchievementCardModel[]>>(
      (acc, card) => {
        acc[card.category].push(card);
        return acc;
      },
      { consistency: [], vocabulary: [], practice: [], milestones: [] },
    );
  }, [filteredCards]);

  const unlockedCount = cards.filter((card) => card.status === "Unlocked").length;
  const completion = cards.length ? Math.round((unlockedCount / cards.length) * 100) : 0;

  const toggleCategory = (category: CategoryKey) => {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/">
          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-sm font-semibold">Achievements</h1>
          <p className="text-xs text-muted-foreground">Track your growth journey</p>
        </div>
        <Badge variant="outline" className="gap-1 text-[11px]">
          <Trophy size={12} />
          {unlockedCount}/{cards.length}
        </Badge>
      </header>

      <div className="px-4 pt-4 pb-2 border-b bg-card/50">
        <Card className="bg-gradient-to-br from-[#ffffff] via-[#f7fbfc] to-[#edf6f8] border-[#d5e7e8]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Progress Summary</p>
                <p className="text-sm font-semibold mt-1">{sessionStats.totalXP} XP</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {sessionStats.currentStreak > 0 ? `${sessionStats.currentStreak} day streak` : "Build your first streak"}
                </p>
              </div>
              <div className="h-14 w-14 rounded-full border-4 border-primary/20 flex items-center justify-center text-primary font-bold">
                {completion}%
              </div>
            </div>
            <div className="mt-3">
              <Progress value={completion} />
              <p className="text-[11px] text-muted-foreground mt-1">{unlockedCount} unlocked achievements</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="px-4 py-3 flex items-center gap-2 overflow-x-auto border-b bg-card/60">
        {FILTERS.map((filter) => (
          <Button
            key={filter.id}
            size="sm"
            variant={activeFilter === filter.id ? "default" : "outline"}
            className="h-8 whitespace-nowrap"
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {(Object.keys(CATEGORY_META) as CategoryKey[]).map((category) => {
          const items = grouped[category];
          if (!items.length) return null;

          return (
            <Card key={category} className="overflow-hidden">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="text-left">
                  <p className="text-sm font-semibold">{CATEGORY_META[category].title}</p>
                  <p className="text-xs text-muted-foreground">{CATEGORY_META[category].subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{items.length}</Badge>
                  {expanded[category] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {expanded[category] && (
                <div className="px-3 pb-3 space-y-2">
                  {items.map((card) => {
                    const title = isKid && card.def.kidTitle ? card.def.kidTitle : card.def.title;
                    const description = isKid && card.def.kidDescription ? card.def.kidDescription : card.def.description;
                    const locked = card.status === "Locked";

                    return (
                      <div
                        key={card.def.id}
                        className={cn(
                          "rounded-xl border px-3 py-3 bg-card/80",
                          card.status === "Unlocked" && "border-[#9fd7cb] bg-[#f2fbf9]",
                          card.status === "In Progress" && "border-[#bed0ff] bg-[#f7f9ff]",
                          locked && "border-border/80 opacity-85",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn("text-2xl mt-0.5", locked && "grayscale opacity-65")}>
                            {locked ? <Lock size={20} className="text-muted-foreground" /> : card.def.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold leading-tight">{title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                              </div>
                              <Badge variant="outline" className="text-[10px]">
                                {card.status}
                              </Badge>
                            </div>

                            <div className="mt-2 flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className="text-[10px]">
                                {card.tier}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] gap-1">
                                <Sparkles size={10} />
                                {card.def.xpReward} pts
                              </Badge>
                            </div>

                            <div className="mt-2">
                              <Progress value={card.progress} className="h-2" />
                              <p className="text-[11px] text-muted-foreground mt-1">{card.progressText}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

