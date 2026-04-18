import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AchievementDef } from "@shared/achievements";
import { ACHIEVEMENTS } from "@shared/achievements";

interface AchievementsPageProps {
  sessionId: number | null;
  mode?: "adult" | "kid";
  totalXP?: number;
  streak?: number;
}

export default function AchievementsPage({ sessionId, mode = "adult", totalXP = 0, streak = 0 }: AchievementsPageProps) {
  const isKid = mode === "kid";

  const { data: unlocked = [] } = useQuery<Array<{ achievementId: string }>>({
    queryKey: ["/api/sessions", sessionId, "achievements"],
    queryFn: () => sessionId
      ? apiRequest("GET", `/api/sessions/${sessionId}/achievements`).then(r => r.json())
      : Promise.resolve([]),
    enabled: !!sessionId,
  });

  const unlockedIds = new Set(unlocked.map(a => a.achievementId));
  const unlockedCount = unlockedIds.size;

  return (
    <div className={cn(
      "flex flex-col h-screen max-w-lg mx-auto",
      isKid ? "bg-gradient-to-b from-yellow-50 via-orange-50 to-pink-50 dark:from-yellow-950/20 dark:to-pink-950/20" : "bg-background"
    )}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        <Link href="/">
          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className={cn("font-semibold leading-none", isKid ? "text-base" : "text-sm")}>
            {isKid ? "🏆 Мои награды" : "Достижения"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unlockedCount}/{ACHIEVEMENTS.length} разблокировано
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-yellow-500">⚡ {totalXP} XP</p>
          {streak > 0 && <p className="text-xs text-orange-500">🔥 {streak} дней</p>}
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-4 py-3 border-b bg-card">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">Прогресс наград</p>
          <p className="text-xs font-medium">{unlockedCount}/{ACHIEVEMENTS.length}</p>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Achievements grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENTS.map(ach => {
            const isUnlocked = unlockedIds.has(ach.id);
            const title = isKid && ach.kidTitle ? ach.kidTitle : ach.title;
            const desc = isKid && ach.kidDescription ? ach.kidDescription : ach.description;

            return (
              <div
                key={ach.id}
                data-testid={`achievement-${ach.id}`}
                className={cn(
                  "flex flex-col items-center text-center p-4 rounded-2xl border-2 transition-all",
                  isUnlocked
                    ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 shadow-sm"
                    : "border-border bg-muted/30 opacity-60"
                )}
              >
                <div className={cn(
                  "text-4xl mb-2 transition-all",
                  isUnlocked ? "" : "grayscale"
                )}>
                  {isUnlocked ? ach.emoji : "🔒"}
                </div>
                <p className={cn(
                  "font-semibold leading-tight mb-1",
                  isKid ? "text-sm" : "text-xs"
                )}>
                  {isUnlocked ? title : "???"}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {isUnlocked ? desc : "Пока не открыто"}
                </p>
                {isUnlocked && (
                  <div className="mt-2 flex items-center gap-1 text-yellow-600">
                    <span className="text-[10px] font-bold">+{ach.xpReward} XP</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
