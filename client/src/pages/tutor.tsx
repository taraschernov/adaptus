import { useState, useRef, useEffect, useCallback } from "react";
import { useWebSocket, type WSMessage } from "@/hooks/useWebSocket";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Link } from "wouter";
import {
  Mic, MicOff, Send, BookOpen, Settings, Volume2, VolumeX,
  Wifi, WifiOff, Brain, Map, Trophy, Dumbbell, MessageSquare,
  ChevronDown, ChevronUp, Flame, Zap, Star, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVELS, LEVEL_ORDER, getLevelProgress } from "@shared/levels";
import type { AppMode } from "@/App";

type Language = "bg" | "en";

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  vocab?: Array<{ word: string; translation: string; lang: string; emoji?: string }>;
  newAchievements?: Array<{ id: string; title: string; emoji: string; xpReward: number }>;
}

const WELCOME: Record<Language, Record<AppMode, string>> = {
  bg: {
    adult: "Здравей! Аз съм Адаптус — твоят AI-учител по български. Как се казваш? (Как тебя зовут?)",
    kid: "Привет! 🎉 Я Адаптус — твой учитель болгарского! Как тебя зовут? Давай учиться вместе! ✨"
  },
  en: {
    adult: "Hello! I'm Adaptus, your AI English tutor. Let's start! What brings you to learning English today?",
    kid: "Hi there! 🎉 I'm Adaptus, your English teacher! What's your name? Let's have fun learning! ✨"
  }
};

const CEFR_COLORS: Record<string, string> = {
  A1: "bg-green-500", A2: "bg-emerald-500", B1: "bg-blue-500", B2: "bg-violet-500",
};

interface TutorPageProps {
  ttsProvider?: string;
  cefrLevel?: string;
  activeScenario?: string | null;
  activeTopicId?: string | null;
  activeTopicTitle?: string | null;
  mode?: AppMode;
  onSessionInit?: (id: number) => void;
  onCefrLevelChange?: (level: string) => void;
  onLanguageChange?: (lang: Language) => void;
  onModeChange?: (mode: AppMode) => void;
  onXPUpdate?: (xp: number) => void;
  onStreakUpdate?: (streak: number) => void;
}

export default function TutorPage({
  ttsProvider = "google",
  cefrLevel = "A1",
  activeScenario = null,
  activeTopicId = null,
  activeTopicTitle = null,
  mode = "adult",
  onSessionInit,
  onCefrLevelChange,
  onLanguageChange,
  onModeChange,
  onXPUpdate,
  onStreakUpdate,
}: TutorPageProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [language, setLanguage] = useState<Language>("bg");
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [status, setStatus] = useState<"idle"|"recording"|"transcribing"|"thinking">("idle");
  const [vocabFlash, setVocabFlash] = useState<Array<{ word: string; translation: string; emoji?: string }>>([]);
  const [msgCounter, setMsgCounter] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);
  const [showLevelPanel, setShowLevelPanel] = useState(false);
  const [totalXP, setTotalXP] = useState(0);
  const [dailyXP, setDailyXP] = useState(0);
  const [streak, setStreak] = useState(0);
  const [achievementToast, setAchievementToast] = useState<{ emoji: string; title: string } | null>(null);
  const initialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  const isKid = mode === "kid";
  const levelCfg = LEVELS[cefrLevel as keyof typeof LEVELS] || LEVELS.A1;
  const levelProgress = getLevelProgress(vocabCount, cefrLevel as any);
  const dailyGoal = 50;
  const dailyProgress = Math.min((dailyXP / dailyGoal) * 100, 100);

  const playAudio = useCallback(async (b64: string) => {
    if (!audioEnabled) return;
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const decoded = await ctx.decodeAudioData(bytes.buffer);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.start();
    } catch {}
  }, [audioEnabled]);

  const showAchievement = (emoji: string, title: string) => {
    setAchievementToast({ emoji, title });
    setTimeout(() => setAchievementToast(null), 3000);
  };

  const handleWSMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case "session":
        setSessionId(msg.sessionId);
        onSessionInit?.(msg.sessionId);
        break;
      case "thinking":
      case "transcribing":
        setStatus(msg.type);
        setIsThinking(true);
        break;
      case "transcript":
        setMessages(prev => [...prev, { id: Date.now(), role: "user", text: msg.text }]);
        setMsgCounter(c => c + 1);
        break;
      case "text_response":
        setIsThinking(false);
        setStatus("idle");
        setMessages(prev => [...prev, {
          id: Date.now(), role: "assistant",
          text: msg.text, vocab: msg.vocab,
          newAchievements: msg.newAchievements
        }]);
        setMsgCounter(c => c + 1);
        if (msg.vocab?.length) {
          setVocabFlash(msg.vocab.slice(0, 3));
          setVocabCount(c => c + msg.vocab.length);
        }
        if (msg.xp !== undefined) {
          setTotalXP(msg.xp);
          onXPUpdate?.(msg.xp);
        }
        if (msg.dailyXP !== undefined) setDailyXP(msg.dailyXP);
        if (msg.streak !== undefined) {
          setStreak(msg.streak);
          onStreakUpdate?.(msg.streak);
        }
        if (msg.newAchievements?.length) {
          const a = msg.newAchievements[0];
          showAchievement(a.emoji, isKid && a.kidTitle ? a.kidTitle : a.title);
        }
        break;
      case "audio_response":
        playAudio(msg.audio);
        break;
      case "topic_set":
        break;
      case "scenario_set":
        break;
      case "cefr_level_set":
        onCefrLevelChange?.(msg.level);
        break;
      case "error":
        setIsThinking(false);
        setStatus("idle");
        setMessages(prev => [...prev, { id: Date.now(), role: "assistant", text: `⚠️ ${msg.message}` }]);
        break;
    }
  }, [playAudio, onSessionInit, onXPUpdate, onStreakUpdate, onCefrLevelChange, isKid]);

  const { send, connected } = useWebSocket(handleWSMessage);

  useEffect(() => {
    if (connected && !initialized.current) {
      initialized.current = true;
      const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || null;
      send({ type: "init", language, level: "beginner", telegramId: tgId, ttsProvider, cefrLevel, activeScenario, mode });
      setMessages([{ id: 0, role: "assistant", text: WELCOME[language][mode] }]);
    }
  }, [connected, language, send, ttsProvider, cefrLevel, activeScenario, mode]);

  // Sync changes from parent
  const prevScenario = useRef(activeScenario);
  const prevTopic = useRef(activeTopicId);
  const prevCefr = useRef(cefrLevel);

  useEffect(() => {
    if (!initialized.current || !connected) return;
    if (activeScenario !== prevScenario.current) {
      prevScenario.current = activeScenario;
      send({ type: "set_scenario", scenarioId: activeScenario });
      if (activeScenario) {
        setMessages(prev => [...prev, { id: Date.now(), role: "assistant", text: "🎭 Начинаем ролевую игру! Я готов к сценарию." }]);
        setMsgCounter(c => c + 1);
      }
    }
    if (activeTopicId !== prevTopic.current) {
      prevTopic.current = activeTopicId;
      send({ type: "set_topic", topicId: activeTopicId, topicTitle: activeTopicTitle });
      if (activeTopicId || activeTopicTitle) {
        const label = activeTopicTitle || activeTopicId;
        setMessages(prev => [...prev, { id: Date.now(), role: "assistant", text: `🗺️ Тема выбрана: ${label}. Давай поговорим!` }]);
        setMsgCounter(c => c + 1);
      }
    }
    if (cefrLevel !== prevCefr.current) {
      prevCefr.current = cefrLevel;
      send({ type: "set_cefr_level", level: cefrLevel });
    }
  }, [activeScenario, activeTopicId, activeTopicTitle, cefrLevel, connected, send]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgCounter, isThinking]);

  const { isRecording, start: startRec, stop: stopRec } = useVoiceRecorder(
    (chunk) => send(chunk),
    () => send({ type: "audio_end" }),
    (err) => { setStatus("idle"); } 
  );

  useEffect(() => {
    if (isRecording) {
      const t = setTimeout(() => {
        if (isRecording) { stopRec(); setStatus("idle"); }
      }, 60000);
      return () => clearTimeout(t);
    }
  }, [isRecording, stopRec]);

  const handleVoiceToggle = () => {
    if (isRecording) { 
      stopRec(); 
      setStatus("idle"); 
    } else { 
      send({ type: "audio_start", language }); 
      startRec(); 
      setStatus("recording"); 
    }
  };

  const sendText = () => {
    const text = inputText.trim();
    if (!text || isThinking) return;
    setInputText("");
    setMessages(prev => [...prev, { id: Date.now(), role: "user", text }]);
    setMsgCounter(c => c + 1);
    send({ type: "text_message", text });
    setStatus("thinking");
    setIsThinking(true);
  };

  const switchLanguage = (lang: Language) => {
    setLanguage(lang);
    onLanguageChange?.(lang);
    send({ type: "switch_language", language: lang });
    setMessages([{ id: Date.now(), role: "assistant", text: WELCOME[lang][mode] }]);
    initialized.current = false;
  };

  const toggleMode = () => {
    const newMode: AppMode = mode === "adult" ? "kid" : "adult";
    onModeChange?.(newMode);
    send({ type: "set_mode", mode: newMode });
    setMessages([{ id: Date.now(), role: "assistant", text: WELCOME[language][newMode] }]);
  };

  const setCefrLevelLocal = (newLevel: string) => {
    onCefrLevelChange?.(newLevel);
    send({ type: "set_cefr_level", level: newLevel });
    setShowLevelPanel(false);
  };

  const statusText: Record<typeof status, string> = {
    idle: "", recording: "Слушаю...", transcribing: "Распознаю...", thinking: "Думаю..."
  };

  // Active context label
  const contextLabel = activeScenario
    ? "🎭 Сценарий"
    : (activeTopicId || activeTopicTitle)
      ? `🗺️ ${activeTopicTitle || activeTopicId}`
      : null;

  return (
    <div className={cn(
      "flex flex-col max-w-lg mx-auto",
      isKid
        ? "bg-gradient-to-b from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20"
        : "bg-background"
    )} style={{ height: "100dvh" }}>

      {/* Achievement toast */}
      {achievementToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-yellow-400 text-yellow-900 font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <span className="text-2xl">{achievementToast.emoji}</span>
          <div>
            <p className="text-xs font-normal opacity-70">{isKid ? "Новая награда!" : "Достижение!"}</p>
            <p>{achievementToast.title}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 32 32" className={cn("shrink-0", isKid ? "w-10 h-10" : "w-8 h-8")} fill="none" aria-label="Адаптус">
            <circle cx="16" cy="16" r="15" fill="hsl(var(--primary))" opacity="0.15"/>
            <path d="M8 22 L16 10 L24 22" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 18 H21" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="16" cy="8" r="2" fill="hsl(var(--primary))"/>
          </svg>
          <div>
            <h1 className={cn("font-semibold leading-none", isKid ? "text-base" : "text-sm")}>
              {isKid ? "Адаптус 🎮" : "Адаптус"}
            </h1>
            {isKid
              ? <p className="text-xs text-primary mt-0.5">⚡ {totalXP} XP • 🔥 {streak} дней</p>
              : <p className="text-xs text-muted-foreground">AI-репетитор</p>
            }
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Lang switcher */}
          <div className="flex rounded-full border overflow-hidden mr-1">
            {(["bg","en"] as Language[]).map(l => (
              <button key={l} data-testid={`lang-${l}`} onClick={() => switchLanguage(l)}
                className={cn("px-3 py-1 text-xs font-medium transition-colors",
                  language === l ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                )}>
                {l === "bg" ? "BG" : "EN"}
              </button>
            ))}
          </div>
          {/* Topic Talk */}
          <Link href="/topics">
            <button data-testid="btn-topics" className="p-2 rounded-lg hover:bg-muted text-muted-foreground relative">
              <MessageSquare size={18} />
              {(activeTopicId || activeTopicTitle) && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}
            </button>
          </Link>
          {/* Scenarios */}
          <Link href="/scenarios">
            <button data-testid="btn-scenarios" className="p-2 rounded-lg hover:bg-muted text-muted-foreground relative">
              <Map size={18} />
              {activeScenario && <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-primary rounded-full" />}
            </button>
          </Link>
          {/* Exercises */}
          <Link href="/exercises">
            <button data-testid="btn-exercises" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <Dumbbell size={18} />
            </button>
          </Link>
          {/* Achievements */}
          <Link href="/achievements">
            <button data-testid="btn-achievements" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <Trophy size={18} />
            </button>
          </Link>
          {/* Vocab */}
          <Link href="/vocab">
            <button data-testid="btn-vocab" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <BookOpen size={18} />
            </button>
          </Link>
          {/* Settings */}
          <Link href="/settings">
            <button data-testid="btn-settings" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <Settings size={18} />
            </button>
          </Link>
          {/* Mode toggle */}
          <button data-testid="btn-mode" onClick={toggleMode}
            className={cn("p-2 rounded-lg transition-colors text-xs font-bold",
              isKid ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" : "hover:bg-muted text-muted-foreground"
            )}>
            {isKid ? "👶" : "🧑"}
          </button>
        </div>
      </header>

      {/* CEFR level + streak bar */}
      <div className="border-b bg-card">
        <button data-testid="btn-level-toggle"
          className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors"
          onClick={() => setShowLevelPanel(p => !p)}>
          <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded text-white shrink-0", CEFR_COLORS[cefrLevel] || "bg-primary")}>
            {cefrLevel}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground truncate">{levelCfg.description}</span>
              <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{vocabCount}/{levelCfg.vocabTarget}</span>
            </div>
            <Progress value={levelProgress} className="h-1" />
          </div>
          {/* Streak */}
          {streak > 0 && (
            <div className="flex items-center gap-1 text-orange-500 shrink-0">
              <Flame size={14} />
              <span className="text-xs font-bold">{streak}</span>
            </div>
          )}
          {/* Daily XP */}
          {!isKid && (
            <div className="flex items-center gap-1 text-yellow-500 shrink-0">
              <Zap size={12} />
              <span className="text-[10px] font-bold">{dailyXP}/{dailyGoal}</span>
            </div>
          )}
          {showLevelPanel ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        {showLevelPanel && (
          <div className="px-4 pb-3 space-y-2">
            {/* Daily goal bar */}
            {!isKid && (
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Дневная цель XP</span><span>{dailyXP}/{dailyGoal} XP</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full transition-all"
                    style={{ width: `${dailyProgress}%` }} />
                </div>
              </div>
            )}
            {/* Level picker */}
            <div className="grid grid-cols-4 gap-2">
              {LEVEL_ORDER.map(lvl => (
                <button key={lvl} data-testid={`level-${lvl}`} onClick={() => setCefrLevelLocal(lvl)}
                  className={cn("py-2 rounded-lg text-xs font-semibold border-2 transition-all",
                    cefrLevel === lvl ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-muted-foreground/50 text-muted-foreground"
                  )}>
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status + context bar */}
      <div className={cn("flex items-center justify-between px-4 py-1.5 text-xs transition-colors",
        connected ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
                  : "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
      )}>
        <div className="flex items-center gap-1.5 min-w-0">
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{connected ? (language === "bg" ? "🇧🇬 Болгарский" : "🇬🇧 Английский") : "Подключение..."}</span>
          {contextLabel && (
            <Badge variant="outline" className="text-[10px] py-0 h-4 ml-1 max-w-[120px] truncate">{contextLabel}</Badge>
          )}
        </div>
        <button onClick={() => setAudioEnabled(a => !a)} data-testid="btn-audio-toggle">
          {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} className="opacity-50" />}
        </button>
      </div>

      {/* Vocab flash */}
      {vocabFlash.length > 0 && (
        <div className="px-4 py-2 flex gap-2 flex-wrap border-b bg-background overflow-x-auto">
          <span className="text-xs text-muted-foreground mt-0.5">Новые слова:</span>
          {vocabFlash.map((v, i) => (
            <Badge key={i} variant="outline" className="text-xs cursor-pointer" onClick={() => setVocabFlash([])}>
              {v.emoji && <span className="mr-1">{v.emoji}</span>}{v.word} → {v.translation}
            </Badge>
          ))}
          <button className="text-xs text-muted-foreground" onClick={() => setVocabFlash([])}>✕</button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "hsl(var(--bg-chat))" }}>
        {messages.map(m => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[82%] px-4 py-2.5 text-sm leading-relaxed shadow-sm",
              m.role === "user" ? "msg-user" : "msg-bot",
              isKid && m.role === "assistant" && "text-base"
            )}>
              <p className="whitespace-pre-wrap">{m.text}</p>
              {/* Achievement unlocked inline */}
              {m.newAchievements?.map(a => (
                <div key={a.id} className="mt-2 flex items-center gap-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <span className="text-xl">{a.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
                      {isKid ? "Награда!" : "Достижение!"} {a.title}
                    </p>
                    <p className="text-[10px] text-yellow-600">+{a.xpReward} XP</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="flex justify-start">
            <div className="msg-bot px-4 py-3 shadow-sm flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">{statusText[status]}</span>
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 typing-dot" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 typing-dot" />
              <span className="w-2 h-2 rounded-full bg-muted-foreground/50 typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t bg-card">
        <div className="flex items-center gap-2">
          <div className="relative">
            {isRecording && <span className="absolute inset-0 rounded-full bg-red-500/30 pulse-ring" />}
            <Button data-testid="btn-voice" size="icon"
              variant={isRecording ? "destructive" : "outline"}
              onClick={handleVoiceToggle} disabled={!connected}
              className={cn("rounded-full w-10 h-10 flex-shrink-0", isKid && "w-12 h-12")}>
              {isRecording ? <MicOff size={isKid ? 18 : 16} /> : <Mic size={isKid ? 18 : 16} />}
            </Button>
          </div>
          <Input
            data-testid="input-message"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendText()}
            placeholder={isKid
              ? (language === "bg" ? "Напиши что-нибудь по-болгарски... 😊" : "Write something in English... 😊")
              : (language === "bg" ? "Напиши или говори по-болгарски..." : "Type or speak in English...")
            }
            disabled={!connected || isThinking}
            className={cn("flex-1 rounded-full", isKid && "text-base")}
          />
          <Button data-testid="btn-send" size="icon"
            onClick={sendText}
            disabled={!connected || !inputText.trim() || isThinking}
            className={cn("rounded-full flex-shrink-0", isKid ? "w-12 h-12" : "w-10 h-10")}>
            <Send size={isKid ? 18 : 16} />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          {isRecording
            ? "🔴 Запись... Нажми ещё раз чтобы остановить"
            : isKid
              ? "Нажми 🎤 и говори или напиши текст! ✨"
              : "Нажми 🎤 для голоса или введи текст"
          }
        </p>
      </div>
    </div>
  );
}
