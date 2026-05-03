import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
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
  ChevronDown, ChevronUp, Flame, Zap, Star, Users, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVELS, LEVEL_ORDER, getLevelProgress } from "@shared/levels";
import { getScenario } from "@shared/scenarios";
import { getTopic } from "@shared/topics";
import type { AppMode } from "@/App";
import type { LearningFocus } from "@shared/learning";
import { LEARNING_FOCUS_LABELS } from "@shared/learning";

type Language = "bg" | "en";
type VoiceMode = "manual" | "auto" | "call";
type MessageCorrection = { wrong: string; right: string; why?: string };

interface WarmupResponse {
  hasWarmup: boolean;
  fromSessionId: number | null;
  nextDrill: string[];
  improvements: Array<{ mistake: string; fix: string; why: string }>;
  wordsForReview: Array<{ word: string; translation: string; lang: "bg" | "en"; context?: string }>;
}

interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  corrections?: MessageCorrection[];
  vocab?: Array<{ word: string; translation: string; lang: string; emoji?: string }>;
  newAchievements?: Array<{ id: string; title: string; emoji: string; xpReward: number; kidTitle?: string }>;
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
  A1: "bg-teal-500", A2: "bg-cyan-500", B1: "bg-indigo-500", B2: "bg-amber-500",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightUserText(text: string, corrections: MessageCorrection[] | undefined): ReactNode {
  if (!corrections?.length) return text;

  type Fragment = { text: string; highlighted: boolean };
  let fragments: Fragment[] = [{ text, highlighted: false }];

  for (const correction of corrections.slice(0, 3)) {
    const wrong = correction.wrong?.trim();
    if (!wrong) continue;
    const rx = new RegExp(`(${escapeRegExp(wrong)})`, "ig");
    fragments = fragments.flatMap((fragment) => {
      if (fragment.highlighted) return [fragment];
      const parts = fragment.text.split(rx);
      if (parts.length === 1) return [fragment];
      return parts
        .filter((part) => part.length > 0)
        .map((part) => ({ text: part, highlighted: part.toLowerCase() === wrong.toLowerCase() }));
    });
  }

  return fragments.map((fragment, idx) =>
    fragment.highlighted ? (
      <span key={idx} className="underline decoration-red-400 decoration-2">
        {fragment.text}
      </span>
    ) : (
      <span key={idx}>{fragment.text}</span>
    )
  );
}

interface TutorPageProps {
  ttsProvider?: string;
  cefrLevel?: string;
  activeScenario?: string | null;
  activeTopicId?: string | null;
  activeTopicTitle?: string | null;
  mode?: AppMode;
  learningFocus?: LearningFocus;
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
  learningFocus = "balanced",
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
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("manual");
  const [callActive, setCallActive] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [status, setStatus] = useState<"idle"|"recording"|"transcribing"|"thinking">("idle");
  const [vocabFlash, setVocabFlash] = useState<Array<{ word: string; translation: string; emoji?: string }>>([]);
  const [msgCounter, setMsgCounter] = useState(0);
  const [vocabCount, setVocabCount] = useState(0);
  const [showLevelPanel, setShowLevelPanel] = useState(false);
  const [totalXP, setTotalXP] = useState(0);
  const [dailyXP, setDailyXP] = useState(0);
  const [streak, setStreak] = useState(0);
  const [achievementToast, setAchievementToast] = useState<{ emoji: string; title: string } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintText, setHintText] = useState("");
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
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
    setIsPlayingAudio(true);
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      if (ctx.state === "suspended") await ctx.resume();
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const decoded = await ctx.decodeAudioData(bytes.buffer);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.onended = () => setIsPlayingAudio(false);
      src.start();
    } catch {
      setIsPlayingAudio(false);
    }
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
        setMessages((prev) => {
          const next = [...prev];
          if (msg.corrections?.length) {
            for (let i = next.length - 1; i >= 0; i--) {
              if (next[i].role === "user") {
                next[i] = {
                  ...next[i],
                  corrections: msg.corrections.slice(0, 3),
                };
                break;
              }
            }
          }
          next.push({
            id: Date.now(),
            role: "assistant",
            text: msg.text,
            vocab: msg.vocab,
            newAchievements: msg.newAchievements,
          });
          return next;
        });
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
      case "learning_focus_set":
        break;
      case "error":
        setIsThinking(false);
        setStatus("idle");
        if (callActive && String(msg.message || "").toLowerCase().includes("микрофон")) {
          setCallActive(false);
        }
        setMessages(prev => [...prev, { id: Date.now(), role: "assistant", text: `⚠️ ${msg.message}` }]);
        break;
    }
  }, [playAudio, onSessionInit, onXPUpdate, onStreakUpdate, onCefrLevelChange, isKid, callActive]);

  const { send, connected } = useWebSocket(handleWSMessage);

  const { data: warmup } = useQuery<WarmupResponse>({
    queryKey: ["/api/sessions", sessionId, "warmup"],
    queryFn: () =>
      sessionId
        ? fetch(`/api/sessions/${sessionId}/warmup`).then((r) => r.json() as Promise<WarmupResponse>)
        : Promise.resolve({
            hasWarmup: false,
            fromSessionId: null,
            nextDrill: [],
            improvements: [],
            wordsForReview: [],
          }),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (connected && !initialized.current) {
      initialized.current = true;
      const tgId = (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || null;
      send({
        type: "init",
        language,
        level: "beginner",
        telegramId: tgId,
        ttsProvider,
        cefrLevel,
        activeScenario,
        mode,
        learningFocus,
      });
      setMessages([{ id: 0, role: "assistant", text: WELCOME[language][mode] }]);
    }
  }, [connected, language, send, ttsProvider, cefrLevel, activeScenario, mode, learningFocus]);

  useEffect(() => {
    setWarmupDismissed(false);
  }, [sessionId]);

  // Sync changes from parent
  const prevScenario = useRef(activeScenario);
  const prevTopic = useRef(activeTopicId);
  const prevCefr = useRef(cefrLevel);
  const prevLearningFocus = useRef(learningFocus);

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
    if (learningFocus !== prevLearningFocus.current) {
      prevLearningFocus.current = learningFocus;
      send({ type: "set_learning_focus", learningFocus });
    }
  }, [activeScenario, activeTopicId, activeTopicTitle, cefrLevel, connected, send, learningFocus]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgCounter, isThinking]);

  const { isRecording, start: startRec, stop: stopRec } = useVoiceRecorder(
    (chunk) => send(chunk),
    () => {
      send({ type: "audio_end" });
      setStatus("transcribing");
      setIsThinking(true);
    },
    (err) => {
      setStatus("idle");
      setIsThinking(false);
      setCallActive(false);
      const raw = String((err as any)?.message || (err as any)?.error?.message || "Ошибка доступа к микрофону");
      const normalized = raw.toLowerCase();
      const message = normalized.includes("not supported")
        ? "В этом браузере микрофон не поддерживается. Открой во внешнем Chrome/Edge."
        : normalized.includes("denied") || normalized.includes("permission") || normalized.includes("notallowed")
          ? "Нет доступа к микрофону. Разреши микрофон для сайта и попробуй снова."
          : "Не удалось запустить микрофон. Проверь разрешение и устройство ввода.";
      setVoiceError(message);
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), role: "assistant", text: `⚠️ ${message}` },
      ]);
      setMsgCounter((c) => c + 1);
    },
    { mode: voiceMode === "manual" ? "manual" : "auto" }
  );

  useEffect(() => {
    if (isRecording) {
      const t = setTimeout(() => {
        if (isRecording) { stopRec(); setStatus("idle"); }
      }, 60000);
      return () => clearTimeout(t);
    }
  }, [isRecording, stopRec]);

  useEffect(() => {
    if (!callActive || voiceMode !== "call") return;
    if (!connected || isRecording || isThinking || isPlayingAudio || status !== "idle") return;

    const timer = setTimeout(() => {
      setShowHint(false);
      setVoiceError(null);
      send({ type: "audio_start", language });
      startRec();
      setStatus("recording");
    }, 350);

    return () => clearTimeout(timer);
  }, [callActive, voiceMode, connected, isRecording, isThinking, isPlayingAudio, status, language, send, startRec]);

  useEffect(() => {
    if (!connected || status !== "idle" || isThinking || isRecording || inputText.trim()) {
      setShowHint(false);
      return;
    }
    const timer = setTimeout(() => {
      setHintText(buildHint());
      setShowHint(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [connected, status, isThinking, isRecording, inputText, msgCounter, learningFocus, activeScenario, activeTopicId, activeTopicTitle]);

  const handleVoiceToggle = () => {
    if (voiceMode === "call") {
      if (callActive) {
        setCallActive(false);
        if (isRecording) stopRec();
        setStatus("idle");
        return;
      }
      setCallActive(true);
      setShowHint(false);
      setVoiceError(null);
      return;
    }

    if (isRecording) {
      stopRec();
      setStatus("idle");
      return;
    }

    setShowHint(false);
    setVoiceError(null);
    send({ type: "audio_start", language });
    startRec();
    setStatus("recording");
  };

  const switchVoiceMode = (nextMode: VoiceMode) => {
    setVoiceMode(nextMode);
    if (nextMode !== "call" && callActive) {
      setCallActive(false);
      if (isRecording) {
        stopRec();
        setStatus("idle");
      }
    }
  };

  const sendText = () => {
    const text = inputText.trim();
    if (!text || isThinking) return;
    setShowHint(false);
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

  const activeScenarioDef = activeScenario ? getScenario(activeScenario) : null;
  const activeTopicDef = activeTopicId ? getTopic(activeTopicId) : null;

  const learningGoal = activeScenarioDef
    ? activeScenarioDef.goal
    : activeTopicDef
      ? `Обсудить тему «${activeTopicDef.title}» и выразить своё мнение 3-4 фразами.`
      : activeTopicTitle
        ? `Свободно обсудить тему «${activeTopicTitle}» с 2-3 уточняющими вопросами.`
        : learningFocus === "grammar"
          ? "Сделать 3-5 реплик и отработать 1 ключевое правило в контексте."
          : learningFocus === "conversation"
            ? "Сделать живой диалог не менее 5 реплик и поддерживать разговор вопросами."
            : "Сделать диалог, исправить 1-2 ошибки и закрепить новую лексику.";

  const buildHint = () => {
    if (activeScenarioDef?.successHints?.length) {
      const phrase = activeScenarioDef.successHints[Math.floor(Math.random() * activeScenarioDef.successHints.length)];
      return `Подсказка для сценария: попробуй фразу «${phrase}».`;
    }
    if (activeTopicDef) {
      return `Попробуй: «Я думаю, что ${activeTopicDef.title.toLowerCase()} важна, потому что...»`;
    }
    if (learningFocus === "grammar") {
      return "Скажи одну фразу и попроси: «исправь и объясни правило».";
    }
    if (learningFocus === "conversation") {
      return "Задай встречный вопрос и добавь один пример из жизни.";
    }
    return "Попробуй короткий ответ + один уточняющий вопрос.";
  };

  // Active context label
  const contextLabel = activeScenario
    ? "🎭 Сценарий"
    : (activeTopicId || activeTopicTitle)
      ? `🗺️ ${activeTopicTitle || activeTopicId}`
      : null;

  const achievementPreview = [
    { id: "first_step", title: "First Step", tier: "Bronze", progress: Math.min((vocabCount / 1) * 100, 100), points: 50 },
    { id: "spark", title: "Three-Day Spark", tier: "Bronze", progress: Math.min((streak / 3) * 100, 100), points: 120 },
    { id: "warrior", title: "Week Warrior", tier: "Silver", progress: Math.min((streak / 7) * 100, 100), points: 300 },
    { id: "focus", title: "Deep Focus", tier: "Silver", progress: Math.min((msgCounter / 25) * 100, 100), points: 400 },
  ];

  return (
    <div className={cn(
      "flex flex-col max-w-lg mx-auto",
      isKid
        ? "bg-gradient-to-b from-teal-50 to-cyan-50 dark:from-teal-950/20 dark:to-cyan-950/20"
        : "bg-background"
    )} style={{ height: "100dvh" }}>

      {/* Achievement toast */}
      {achievementToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-amber-300 text-amber-900 font-bold px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-bounce">
          <span className="text-2xl">{achievementToast.emoji}</span>
          <div>
            <p className="text-xs font-normal opacity-70">{isKid ? "Новая награда!" : "Достижение!"}</p>
            <p>{achievementToast.title}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b bg-card/85 backdrop-blur">
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
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-secondary rounded-full" />
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
          {/* Session review */}
          <Link href="/session-review">
            <button data-testid="btn-session-review" className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
              <FileText size={18} />
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
              isKid ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30" : "hover:bg-muted text-muted-foreground"
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
            <div className="flex items-center gap-1 text-amber-500 shrink-0">
              <Flame size={14} />
              <span className="text-xs font-bold">{streak}</span>
            </div>
          )}
          {/* Daily XP */}
          {!isKid && (
            <div className="flex items-center gap-1 text-amber-500 shrink-0">
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
                  <div className="h-full bg-gradient-to-r from-teal-500 to-indigo-500 rounded-full transition-all"
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

      <div className="px-4 py-3 border-b bg-card/45 space-y-3">
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-[#f7fbfb] to-[#eef6f8] p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Today&apos;s Focus</p>
              <p className="text-sm font-semibold mt-1">
                {learningFocus === "conversation" ? "Build a 5-turn dialog" : learningFocus === "grammar" ? "Practice one key rule" : "Balanced speaking + corrections"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{activeTopicTitle || activeScenarioDef?.title || "Keep the conversation alive with one follow-up question."}</p>
            </div>
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 flex items-center justify-center text-primary text-xs font-bold">
              {Math.round(dailyProgress)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Link href="/scenarios">
            <button className="w-full rounded-xl border border-border bg-card px-2 py-2 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors">
              Start Session
            </button>
          </Link>
          <Link href="/vocab">
            <button className="w-full rounded-xl border border-border bg-card px-2 py-2 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors">
              Log Habit
            </button>
          </Link>
          <Link href="/session-review">
            <button className="w-full rounded-xl border border-border bg-card px-2 py-2 text-xs font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors">
              Reflect
            </button>
          </Link>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Achievements Preview</p>
            <Link href="/achievements">
              <button className="text-[11px] font-medium text-primary">Open</button>
            </Link>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {achievementPreview.map((item) => (
              <div key={item.id} className="min-w-[140px] rounded-xl border border-border bg-card px-2.5 py-2">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold truncate">{item.title}</p>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">{item.tier}</Badge>
                </div>
                <Progress value={item.progress} className="h-1.5 mt-2" />
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{Math.round(item.progress)}%</span>
                  <span>{item.points} pts</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status + context bar */}
      <div className={cn("flex items-center justify-between px-4 py-1.5 text-xs transition-colors",
        connected ? "bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300"
                  : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
      )}>
        <div className="flex items-center gap-1.5 min-w-0">
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span>{connected ? (language === "bg" ? "🇧🇬 Болгарский" : "🇬🇧 Английский") : "Подключение..."}</span>
          {contextLabel && (
            <Badge variant="outline" className="text-[10px] py-0 h-4 ml-1 max-w-[120px] truncate">{contextLabel}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border overflow-hidden bg-card/60">
            <button
              data-testid="voice-mode-manual"
              onClick={() => switchVoiceMode("manual")}
              className={cn(
                "px-2 py-0.5 text-[10px]",
                voiceMode === "manual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Push
            </button>
            <button
              data-testid="voice-mode-auto"
              onClick={() => switchVoiceMode("auto")}
              className={cn(
                "px-2 py-0.5 text-[10px]",
                voiceMode === "auto" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Hands-free
            </button>
            <button
              data-testid="voice-mode-call"
              onClick={() => switchVoiceMode("call")}
              className={cn(
                "px-2 py-0.5 text-[10px]",
                voiceMode === "call" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Call
            </button>
          </div>
          {voiceMode === "call" && (
            <Badge variant={callActive ? "default" : "outline"} className="text-[10px] h-4 px-1.5">
              {callActive ? "LIVE" : "Ready"}
            </Badge>
          )}
          <button onClick={() => setAudioEnabled(a => !a)} data-testid="btn-audio-toggle">
            {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} className="opacity-50" />}
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b bg-card/60">
        <div className="rounded-lg border bg-card p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Цель занятия</p>
            <Badge variant="outline" className="text-[10px]">
              {LEARNING_FOCUS_LABELS[learningFocus]}
            </Badge>
          </div>
          <p className="text-xs mt-1">{learningGoal}</p>
        </div>
      </div>

      {warmup?.hasWarmup && !warmupDismissed && (
        <div className="px-4 py-2 border-b bg-card/40">
          <div className="rounded-lg border border-indigo-300/40 bg-indigo-50/40 dark:bg-indigo-950/20 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Разминка из прошлых ошибок</p>
              <button
                onClick={() => setWarmupDismissed(true)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Скрыть
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {warmup.nextDrill.slice(0, 3).map((drill, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputText(drill);
                    setWarmupDismissed(true);
                  }}
                  className="text-xs px-2 py-1 rounded-md bg-card border hover:border-primary/60"
                >
                  {drill}
                </button>
              ))}
              {!warmup.nextDrill.length && (
                <span className="text-xs text-muted-foreground">Пока нет готовой разминки.</span>
              )}
            </div>
          </div>
        </div>
      )}

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
              <p className="whitespace-pre-wrap">
                {m.role === "user" ? highlightUserText(m.text, m.corrections) : m.text}
              </p>
              {m.role === "user" && m.corrections?.length ? (
                <div className="mt-2 space-y-1">
                  {m.corrections.slice(0, 2).map((c, idx) => (
                    <div key={idx} className="text-[11px] rounded-md border border-red-300/40 bg-red-50/40 dark:bg-red-950/20 p-1.5">
                      <p className="line-through decoration-red-400">{c.wrong}</p>
                      <p className="text-teal-700 dark:text-teal-400">{c.right}</p>
                      {c.why && <p className="text-muted-foreground">{c.why}</p>}
                    </div>
                  ))}
                </div>
              ) : null}
              {/* Achievement unlocked inline */}
              {m.newAchievements?.map(a => (
                <div key={a.id} className="mt-2 flex items-center gap-2 p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <span className="text-xl">{a.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      {isKid ? "Награда!" : "Достижение!"} {a.title}
                    </p>
                    <p className="text-[10px] text-amber-600">+{a.xpReward} XP</p>
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
        {voiceError && (
          <div className="mb-2 rounded-lg border border-red-300/40 bg-red-50/40 dark:bg-red-950/20 px-3 py-2">
            <p className="text-xs text-red-700 dark:text-red-300">{voiceError}</p>
          </div>
        )}
        {showHint && hintText && (
          <div className="mb-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 flex items-start gap-2">
            <div className="flex-1">
              <p className="text-[11px] text-primary font-semibold">Подсказка</p>
              <p className="text-xs text-muted-foreground mt-0.5">{hintText}</p>
            </div>
            <button
              onClick={() => {
                setInputText(hintText);
                setShowHint(false);
              }}
              className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground"
            >
              Вставить
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            {isRecording && <span className="pointer-events-none absolute inset-0 rounded-full bg-red-500/30 pulse-ring" />}
            <Button data-testid="btn-voice" size="icon"
              variant={isRecording || (voiceMode === "call" && callActive) ? "destructive" : "outline"}
              onClick={handleVoiceToggle} disabled={!connected}
              className={cn("rounded-full w-10 h-10 flex-shrink-0", isKid && "w-12 h-12")}>
              {(isRecording || (voiceMode === "call" && callActive)) ? <MicOff size={isKid ? 18 : 16} /> : <Mic size={isKid ? 18 : 16} />}
            </Button>
          </div>
            <Input
              data-testid="input-message"
              value={inputText}
              onChange={e => {
                setInputText(e.target.value);
                if (showHint) setShowHint(false);
              }}
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
          {voiceMode === "call" && callActive
            ? (isRecording
                ? "📞 Call mode: слушаю тебя..."
                : isThinking || isPlayingAudio
                  ? "📞 Call mode: агент отвечает, скоро снова начну слушать"
                  : "📞 Call mode активен")
            : isRecording
            ? voiceMode === "auto"
              ? "🔴 Запись... остановится автоматически после паузы"
              : "🔴 Запись... Нажми ещё раз чтобы остановить"
            : isKid
              ? `Нажми 🎤 (${voiceMode === "call" ? "call" : voiceMode === "auto" ? "hands-free" : "push-to-talk"}) и говори! ✨`
              : `Нажми 🎤 (${voiceMode === "call" ? "call" : voiceMode === "auto" ? "hands-free" : "push-to-talk"}) или введи текст`
          }
        </p>
      </div>
    </div>
  );
}
