import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Play, PenLine, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Topic, TopicCategory } from "@shared/topics";
import { TOPIC_CATEGORIES } from "@shared/topics";

type Language = "bg" | "en";

const CEFR_COLORS: Record<string, string> = {
  A1: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  A2: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  B1: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  B2: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
};

interface TopicsPageProps {
  sessionId: number | null;
  cefrLevel: string;
  language: Language;
  kidMode?: boolean;
  onSelectTopic: (topicId: string | null, topicTitle: string | null) => void;
}

export default function TopicsPage({ sessionId, cefrLevel, language, kidMode = false, onSelectTopic }: TopicsPageProps) {
  const [, navigate] = useLocation();
  const [activeCategory, setActiveCategory] = useState<TopicCategory | "all">("all");
  const [customTopic, setCustomTopic] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [activeLang, setActiveLang] = useState<Language>(language);

  const { data: topics = [], isLoading } = useQuery<Topic[]>({
    queryKey: ["/api/topics", activeLang, kidMode],
    queryFn: () => apiRequest("GET", `/api/topics?lang=${activeLang}${kidMode ? "&kid=true" : ""}`).then(r => r.json()),
  });

  const categories = [...new Set(topics.map(t => t.category))] as TopicCategory[];

  const filtered = topics.filter(t =>
    activeCategory === "all" || t.category === activeCategory
  );

  const handleSelect = (topicId: string, topicTitle: string) => {
    onSelectTopic(topicId, topicTitle);
    navigate("/");
  };

  const handleCustom = () => {
    if (!customTopic.trim()) return;
    onSelectTopic(null, customTopic.trim());
    navigate("/");
  };

  return (
    <div className={cn(
      "flex flex-col h-screen max-w-lg mx-auto",
      kidMode ? "bg-gradient-to-b from-yellow-50 to-green-50 dark:from-yellow-950/20 dark:to-green-950/20" : "bg-background"
    )}>
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card shadow-sm">
        <Link href="/">
          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="font-semibold text-sm leading-none">
            {kidMode ? "🗺️ Что будем учить?" : "Беседа по теме"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {kidMode ? "Выбери интересную тему!" : "Выбери тему для разговора с AI"}
          </p>
        </div>
      </header>

      {/* Lang tabs (не в детском режиме — там обе) */}
      {!kidMode && (
        <div className="flex border-b bg-card">
          {(["bg", "en"] as Language[]).map(l => (
            <button key={l} onClick={() => setActiveLang(l)}
              className={cn("flex-1 py-2.5 text-sm font-medium transition-colors",
                activeLang === l ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              {l === "bg" ? "🇧🇬 Болгарский" : "🇬🇧 Английский"}
            </button>
          ))}
        </div>
      )}

      {/* Category chips */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto border-b">
        <button onClick={() => setActiveCategory("all")}
          className={cn("flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all",
            activeCategory === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50"
          )}>
          🔍 Все
        </button>
        {categories.map(cat => {
          const def = TOPIC_CATEGORIES[cat];
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={cn("flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all",
                activeCategory === cat ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:border-primary/50"
              )}>
              {def.emoji} {def.label}
            </button>
          );
        })}
      </div>

      {/* Custom topic */}
      <div className="px-4 pt-3">
        {!showCustom ? (
          <button onClick={() => setShowCustom(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 text-left transition-all">
            <span className="text-2xl">✏️</span>
            <div>
              <p className="text-sm font-medium">{kidMode ? "Своя тема!" : "Своя тема"}</p>
              <p className="text-xs text-muted-foreground">
                {kidMode ? "Хочешь поговорить о чём-то своём?" : "Введи любую тему — AI подхватит"}
              </p>
            </div>
          </button>
        ) : (
          <div className="flex gap-2">
            <Input
              autoFocus
              value={customTopic}
              onChange={e => setCustomTopic(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCustom()}
              placeholder={kidMode ? "Например: динозавры, Майнкрафт, космос..." : "Например: климат в Болгарии, крипто, ИИ..."}
              className="flex-1"
            />
            <Button onClick={handleCustom} disabled={!customTopic.trim()} size="sm">
              <Play size={14} />
            </Button>
            <Button variant="ghost" onClick={() => setShowCustom(false)} size="sm">✕</Button>
          </div>
        )}
      </div>

      {/* Topics list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse"/>)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm">Нет тем в этой категории</p>
          </div>
        ) : (
          filtered.map(topic => {
            const isCurrentLevel = topic.level.includes(cefrLevel);
            return (
              <button key={topic.id} data-testid={`topic-${topic.id}`}
                onClick={() => handleSelect(topic.id, topic.title)}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:border-primary/50",
                  isCurrentLevel ? "border-primary/30 bg-primary/5" : "border-border bg-card"
                )}>
                <span className="text-2xl mt-0.5 shrink-0">
                  {topic.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn("font-medium", kidMode ? "text-base" : "text-sm")}>{topic.title}</p>
                    {topic.level.map(lvl => (
                      <span key={lvl} className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", CEFR_COLORS[lvl] || "bg-muted text-muted-foreground")}>
                        {lvl}
                      </span>
                    ))}
                    {isCurrentLevel && (
                      <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary text-primary">
                        Твой уровень
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{topic.description}</p>
                </div>
                <div className="shrink-0 mt-1">
                  <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
                    <Mic size={14} />
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}


