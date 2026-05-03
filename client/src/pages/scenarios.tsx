import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Scenario } from "@shared/scenarios";

type Language = "bg" | "en";

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  A2: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  B1: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  B2: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

interface ScenariosPageProps {
  sessionId: number | null;
  activeScenario: string | null;
  cefrLevel: string;
  onSelectScenario: (scenarioId: string | null) => void;
}

export default function ScenariosPage({
  sessionId,
  activeScenario,
  cefrLevel,
  onSelectScenario,
}: ScenariosPageProps) {
  const [, navigate] = useLocation();
  const [activeLang, setActiveLang] = useState<Language>("bg");
  const [selected, setSelected] = useState<string | null>(activeScenario);

  const { data: scenarios = [], isLoading } = useQuery<Scenario[]>({
    queryKey: ["/api/scenarios", activeLang],
    queryFn: () => apiRequest("GET", `/api/scenarios?lang=${activeLang}`).then(r => r.json()),
  });

  const handleSelect = async (scenarioId: string | null) => {
    setSelected(scenarioId);
    onSelectScenario(scenarioId);
    // Дать время анимации, потом назад
    setTimeout(() => navigate("/"), 300);
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/">
          <button
            data-testid="btn-back"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div>
          <h1 className="font-semibold text-sm leading-none">Ролевые сценарии</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Выбери ситуацию для практики
          </p>
        </div>
      </header>

      {/* Lang tabs */}
      <div className="flex border-b bg-card">
        {(["bg", "en"] as Language[]).map((l) => (
          <button
            key={l}
            data-testid={`tab-lang-${l}`}
            onClick={() => setActiveLang(l)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors",
              activeLang === l
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {l === "bg" ? "🇧🇬 Болгарский" : "🇬🇧 Английский"}
          </button>
        ))}
      </div>

      {/* Free chat option */}
      <div className="px-4 pt-3">
        <button
          data-testid="btn-free-chat"
          onClick={() => handleSelect(null)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left",
            selected === null
              ? "border-primary/40 bg-primary/5"
              : "border-border hover:border-muted-foreground/50"
          )}
        >
          <span className="text-2xl">💬</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Свободный чат</p>
            <p className="text-xs text-muted-foreground">
              Общение на любые темы без сценария
            </p>
          </div>
          {selected === null && (
            <Badge variant="default" className="text-xs shrink-0">
              Активен
            </Badge>
          )}
        </button>
      </div>

      {/* Scenarios list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          scenarios.map((s) => {
            const isActive = selected === s.id;
            const isCurrentLevel = s.level.includes(cefrLevel);

            return (
              <button
                key={s.id}
                data-testid={`scenario-${s.id}`}
                onClick={() => handleSelect(s.id)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left",
                  isActive
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-muted-foreground/50"
                )}
              >
                <span className="text-2xl mt-0.5">{s.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{s.title}</p>
                    {s.level.map((lvl) => (
                      <span
                        key={lvl}
                        className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded",
                          LEVEL_COLORS[lvl] || "bg-muted text-muted-foreground",
                          isCurrentLevel && "ring-1 ring-current"
                        )}
                      >
                        {lvl}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {s.setting}
                  </p>
                  <p className="text-xs text-primary/80 mt-1">
                    Цель: {s.goal}
                  </p>
                </div>
                {isActive && (
                  <Badge variant="default" className="text-xs shrink-0 mt-0.5">
                    Активен
                  </Badge>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Bottom action */}
      {selected && (
        <div className="px-4 py-3 border-t bg-card">
          <Link href="/">
            <Button
              data-testid="btn-start-scenario"
              className="w-full"
              size="sm"
            >
              <Play size={14} className="mr-1.5" />
              Начать сценарий
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
