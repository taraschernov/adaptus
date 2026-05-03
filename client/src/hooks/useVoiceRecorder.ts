import { useState, useRef, useCallback } from "react";

type VoiceMode = "manual" | "auto";

interface VoiceRecorderOptions {
  mode?: VoiceMode;
  silenceThreshold?: number;
  silenceMs?: number;
}

export function useVoiceRecorder(
  onChunk: (chunk: ArrayBuffer) => void,
  onStop: () => void,
  onError?: (err: any) => void,
  options?: VoiceRecorderOptions
) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const optionsRef = useRef({
    mode: options?.mode ?? "manual",
    silenceThreshold: options?.silenceThreshold ?? 0.02,
    silenceMs: options?.silenceMs ?? 1600,
  });
  optionsRef.current = {
    mode: options?.mode ?? "manual",
    silenceThreshold: options?.silenceThreshold ?? 0.02,
    silenceMs: options?.silenceMs ?? 1600,
  };
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundRef = useRef<number>(Date.now());
  const heardSpeechRef = useRef(false);

  const stopSilenceWatcher = useCallback(() => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    heardSpeechRef.current = false;
  }, []);

  const start = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported in this browser/environment.");
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      lastSoundRef.current = Date.now();
      heardSpeechRef.current = false;

      let options = {};
      if (typeof MediaRecorder !== "undefined" && typeof MediaRecorder.isTypeSupported === "function") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          options = { mimeType: "audio/webm;codecs=opus" };
        } else if (MediaRecorder.isTypeSupported("audio/webm")) {
          options = { mimeType: "audio/webm" };
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          options = { mimeType: "audio/mp4" };
        }
      }

      const mr = new MediaRecorder(s, options);
      mediaRecorder.current = mr;

      mr.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const ab = await e.data.arrayBuffer();
          onChunk(ab);
        }
      };

      mr.onstop = () => {
        stopSilenceWatcher();
        stream.current?.getTracks().forEach(t => t.stop());
        onStop();
      };

      mr.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
          try { mediaRecorder.current.stop(); } catch {}
        }
        stopSilenceWatcher();
        setIsRecording(false);
        onError?.(e);
      };

      mr.start(250); // chunk every 250ms

      const mode = optionsRef.current.mode;
      if (mode === "auto" && typeof AudioContext !== "undefined") {
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        audioContextRef.current = ctx;
        analyserRef.current = analyser;

        const threshold = optionsRef.current.silenceThreshold;
        const silenceMs = optionsRef.current.silenceMs;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        silenceTimerRef.current = setInterval(() => {
          if (!analyserRef.current || !mediaRecorder.current || mediaRecorder.current.state === "inactive") return;
          analyserRef.current.getByteTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / dataArray.length);
          const now = Date.now();
          if (rms > threshold) {
            heardSpeechRef.current = true;
            lastSoundRef.current = now;
            return;
          }
          if (heardSpeechRef.current && now - lastSoundRef.current > silenceMs) {
            try {
              mediaRecorder.current.stop();
              setIsRecording(false);
            } catch {}
          }
        }, 200);
      }

      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      onError?.(err);
    }
  }, [onChunk, onStop, onError, stopSilenceWatcher]);

  const stop = useCallback(() => {
    try {
      if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
        mediaRecorder.current.stop();
      }
    } catch (err) {
      console.error("Error stopping MediaRecorder:", err);
    } finally {
      stopSilenceWatcher();
      setIsRecording(false);
    }
  }, [stopSilenceWatcher]);

  return { isRecording, start, stop };
}
