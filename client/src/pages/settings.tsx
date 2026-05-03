import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, Settings, ExternalLink, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { LearningFocus } from "@shared/learning";
import { LEARNING_FOCUS_LABELS } from "@shared/learning";

interface HealthData {
  status: string;
  hasGemini: boolean;
  hasOpenRouter: boolean;
  hasDeepgram: boolean;
  ttsProviders: string[];
}

interface SettingsPageProps {
  ttsProvider: string;
  learningFocus: LearningFocus;
  onTtsChange: (provider: string) => void;
  onLearningFocusChange: (focus: LearningFocus) => void;
}

export default function SettingsPage({
  ttsProvider,
  learningFocus,
  onTtsChange,
  onLearningFocusChange,
}: SettingsPageProps) {
  const [copied, setCopied] = useState("");
  const envFilePath = "C:\\Users\\taras\\Documents\\New project\\adaptus\\.env";

  const { data: health } = useQuery<HealthData>({
    queryKey: ["/api/health"],
    queryFn: () => apiRequest("GET", "/api/health").then(r => r.json()),
  });

  const copyToClipboard = (text: string, key: string) => {
    try {
      // navigator.clipboard недоступен в Telegram iframe
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        // fallback для Telegram
        const el = document.createElement("textarea");
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
    } catch {}
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const openExternal = (url: string) => {
    const tg = (window as any)?.Telegram?.WebApp;
    if (tg?.openLink) {
      tg.openLink(url);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const apiLinks = [
    { name: "Gemini API Key (ИИ мозг)", url: "https://aistudio.google.com/apikey", active: health?.hasGemini, envKey: "GEMINI_API_KEY", required: true },
    { name: "OpenRouter (резерв AI, бесплатно)", url: "https://openrouter.ai/keys", active: health?.hasOpenRouter, envKey: "OPENROUTER_API_KEY", required: false },
    { name: "Deepgram (голос → текст)", url: "https://console.deepgram.com/signup", active: health?.hasDeepgram, envKey: "DEEPGRAM_API_KEY", required: false },
  ];

  const ttsOptions = [
    {
      id: "google",
      name: "Google Cloud TTS",
      description: "Бесплатно · 1 млн символов/мес · Neural2",
      envKey: "GOOGLE_TTS_API_KEY",
      url: "https://console.cloud.google.com/apis/library/texttospeech.googleapis.com",
      available: health?.ttsProviders.includes("google"),
    },
    {
      id: "elevenlabs",
      name: "ElevenLabs Flash v2.5",
      description: "Бесплатно · 20к символов/мес · выше качество",
      envKey: "ELEVENLABS_API_KEY",
      url: "https://elevenlabs.io/app/sign-up",
      available: health?.ttsProviders.includes("elevenlabs"),
    },
  ];

  const learningFocusOptions: Array<{ id: LearningFocus; description: string }> = [
    {
      id: "conversation",
      description: "Больше живого диалога и тренировки речи.",
    },
    {
      id: "balanced",
      description: "Диалог + разбор ошибок + микро-объяснение грамматики.",
    },
    {
      id: "grammar",
      description: "Больше объяснений правил, примеров и мини-дриллов.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-background">
      <header className="flex items-center gap-3 px-4 py-3 border-b bg-card/85 backdrop-blur">
        <Link href="/">
          <button data-testid="btn-back" className="p-1.5 rounded-lg hover:bg-muted">
            <ArrowLeft size={18} />
          </button>
        </Link>
        <Settings size={18} className="text-primary" />
        <h1 className="font-semibold text-sm">Настройки</h1>
      </header>

      <div className="flex-1 px-4 py-4 space-y-6">
        {/* Where to store keys */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Где хранятся ключи</h2>
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-sm">Ключи вводятся в файл <code className="text-xs bg-muted px-1 rounded">.env</code>, не в форму внутри приложения.</p>
            <p className="text-xs font-mono text-muted-foreground break-all">{envFilePath}</p>
            <p className="text-xs text-muted-foreground">После изменения файла перезапусти сервер, чтобы применить ключи.</p>
          </div>
        </section>

        {/* Learning focus */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Режим обучения</h2>
          <div className="space-y-2">
            {learningFocusOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onLearningFocusChange(opt.id)}
                className={cn(
                  "w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all",
                  learningFocus === opt.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0",
                    learningFocus === opt.id ? "border-primary bg-primary" : "border-muted-foreground"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{LEARNING_FOCUS_LABELS[opt.id]}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* TTS switcher */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Голос (синтез речи)</h2>
          <div className="space-y-2">
            {ttsOptions.map(opt => (
              <button
                key={opt.id}
                data-testid={`tts-${opt.id}`}
                onClick={() => opt.available && onTtsChange(opt.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                  ttsProvider === opt.id
                    ? "border-primary bg-primary/5"
                    : "bg-card hover:bg-muted",
                  !opt.available && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border-2 flex-shrink-0",
                  ttsProvider === opt.id ? "border-primary bg-primary" : "border-muted-foreground"
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{opt.name}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                  <p className="text-xs font-mono text-muted-foreground/60">{opt.envKey}</p>
                </div>
                <div className="flex items-center gap-1">
                  {opt.available
                    ? <Badge variant="outline" className="text-xs text-teal-600 border-teal-300">Активен</Badge>
                    : <Badge variant="outline" className="text-xs">Ключ не задан</Badge>
                  }
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openExternal(opt.url);
                    }}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    aria-label={`Открыть ${opt.name}`}
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </button>
            ))}
            <p className="text-xs text-muted-foreground px-1">
              Если ни один ключ не задан — текст-в-речь отключён, работает только текстовый чат.
            </p>
          </div>
        </section>

        {/* API Status */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Статус API</h2>
          <div className="space-y-2">
            {apiLinks.map(api => (
              <div key={api.envKey} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", api.active ? "bg-teal-500" : "bg-red-400")} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{api.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{api.envKey}</p>
                </div>
                <div className="flex items-center gap-1">
                  {api.required && !api.active && <Badge variant="destructive" className="text-xs">Обязателен</Badge>}
                  <button
                    type="button"
                    data-testid={`btn-api-${api.envKey}`}
                    onClick={() => openExternal(api.url)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                    aria-label={`Открыть ${api.name}`}
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* .env example */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">.env пример</h2>
          <div className="relative rounded-xl border bg-muted p-4">
            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">{`GEMINI_API_KEY=your_gemini_key_here
DEEPGRAM_API_KEY=your_deepgram_key_here

# Резерв AI при исчерпании Gemini (бесплатно на openrouter.ai):
OPENROUTER_API_KEY=your_openrouter_key_here

# Выбери один (или оба — переключишь в настройках):
GOOGLE_TTS_API_KEY=your_google_tts_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here

NODE_ENV=production
PORT=5000

# Для локальных тестов (чтобы не блокироваться при квоте Gemini):
ALLOW_LOCAL_AI_FALLBACK=true`}</pre>
            <button
              onClick={() => copyToClipboard("GEMINI_API_KEY=\nDEEPGRAM_API_KEY=\nGOOGLE_TTS_API_KEY=\nELEVENLABS_API_KEY=\nOPENROUTER_API_KEY=\nNODE_ENV=development\nPORT=5000\nALLOW_LOCAL_AI_FALLBACK=true", "env")}
              data-testid="btn-copy-env"
              className="absolute top-3 right-3 p-1.5 rounded hover:bg-background text-muted-foreground"
            >
              {copied === "env" ? <Check size={14} className="text-teal-500" /> : <Copy size={14} />}
            </button>
          </div>
        </section>

        {/* Telegram setup */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Telegram Mini App</h2>
          <div className="rounded-xl border bg-card p-4 space-y-2 text-sm text-muted-foreground">
            <p>1. @BotFather → /newbot → получи токен</p>
            <p>2. /newapp → укажи URL задеплоенного сайта</p>
            <p>3. Ссылка: <code className="text-xs bg-muted px-1 rounded">t.me/BOTNAME/app</code></p>
          </div>
        </section>
      </div>
    </div>
  );
}
