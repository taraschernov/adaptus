/**
 * TTS провайдеры с переключением
 *
 * Порядок приоритетов:
 *   1. ElevenLabs Flash v2.5 — если задан ключ (бесплатно 10k символов/мес)
 *   2. Google Cloud TTS Neural2 — если задан ключ (бесплатно 1M символов/мес для WaveNet/Neural)
 *   3. Без звука — возвращаем null, клиент просто не воспроизводит
 */

type TTSProvider = "elevenlabs" | "google" | "none";

function detectProvider(preferred?: string): TTSProvider {
  if (preferred === "elevenlabs" && process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (preferred === "google" && process.env.GOOGLE_TTS_API_KEY) return "google";
  // auto-detect
  if (process.env.ELEVENLABS_API_KEY) return "elevenlabs";
  if (process.env.GOOGLE_TTS_API_KEY) return "google";
  return "none";
}

// ElevenLabs voice IDs
const ELEVENLABS_VOICES: Record<string, string> = {
  en: "21m00Tcm4TlvDq8ikWAM", // Rachel — нейтральный английский
  bg: "pNInz6obpgDQGcFmaJgB", // Adam — поддерживает болгарский через multilingual v2
};

// Google Cloud TTS voices для болгарского и английского
// Neural2 = самое высокое качество бесплатно
const GOOGLE_VOICES: Record<string, { languageCode: string; name: string }> = {
  bg: { languageCode: "bg-BG", name: "bg-BG-Standard-A" },    // стандартный, WaveNet/Neural2 недоступны для BG через бесплатный ключ
  en: { languageCode: "en-US", name: "en-US-Neural2-F" },     // Neural2 женский
};

export async function synthesize(
  text: string,
  language: string,
  preferred?: string
): Promise<Buffer | null> {
  const provider = detectProvider(preferred);

  if (provider === "elevenlabs") {
    return synthesizeElevenLabs(text, language);
  } else if (provider === "google") {
    return synthesizeGoogle(text, language);
  }
  return null;
}

async function synthesizeElevenLabs(text: string, language: string): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const voiceId = ELEVENLABS_VOICES[language] || ELEVENLABS_VOICES.en;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=3`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 500),
          model_id: "eleven_flash_v2_5",  // бесплатный тир, 32 языка, 75ms latency
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!response.ok) {
      console.error("ElevenLabs error:", await response.text());
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (e) {
    console.error("ElevenLabs TTS failed:", e);
    return null;
  }
}

async function synthesizeGoogle(text: string, language: string): Promise<Buffer | null> {
  const apiKey = process.env.GOOGLE_TTS_API_KEY!;
  const voice = GOOGLE_VOICES[language] || GOOGLE_VOICES.en;

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: text.slice(0, 1000) },
          voice: { languageCode: voice.languageCode, name: voice.name },
          audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: 0 },
        }),
      }
    );

    if (!response.ok) {
      console.error("Google TTS error:", await response.text());
      return null;
    }

    const data = await response.json() as { audioContent: string };
    return Buffer.from(data.audioContent, "base64");
  } catch (e) {
    console.error("Google TTS failed:", e);
    return null;
  }
}

export function getAvailableProviders(): string[] {
  const providers: string[] = [];
  if (process.env.ELEVENLABS_API_KEY) providers.push("elevenlabs");
  if (process.env.GOOGLE_TTS_API_KEY) providers.push("google");
  if (providers.length === 0) providers.push("none");
  return providers;
}
