import { useEffect, useRef, useCallback, useState } from "react";
import type { LearningFocus } from "@shared/learning";

export type WSMessage =
  | { type: "session"; sessionId: number }
  | { type: "thinking" }
  | { type: "transcribing" }
  | { type: "transcript"; text: string }
  | {
      type: "text_response";
      text: string;
      vocab: Array<{ word: string; translation: string; lang: string }>;
      corrections?: Array<{ wrong: string; right: string; why?: string }>;
      taskComplete?: boolean;
      xp?: number;
      dailyXP?: number;
      streak?: number;
      newAchievements?: Array<{ id: string; title: string; emoji: string; xpReward: number; kidTitle?: string }>;
    }
  | { type: "audio_response"; audio: string }
  | { type: "language_switched"; language: string }
  | { type: "tts_switched"; provider: string }
  | { type: "topic_set"; topicId: string | null; topicTitle: string | null }
  | { type: "scenario_set"; scenarioId: string | null }
  | { type: "cefr_level_set"; level: string }
  | { type: "mode_set"; mode: "adult" | "kid" }
  | { type: "learning_focus_set"; learningFocus: LearningFocus }
  | { type: "error"; message: string };

export function useWebSocket(onMessage: (msg: WSMessage) => void) {
  const ws = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onMessageRef.current = onMessage;

  useEffect(() => {
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => {
        setConnected(true);
        // Heartbeat: Railway / Render закрывают idle WS через ~55 сек
        // Отправляем ping каждые 30 сек чтобы держать соединение живым
        pingRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30_000);
      };

      socket.onclose = () => {
        setConnected(false);
        if (pingRef.current) clearInterval(pingRef.current);
        // Отправляем фейковую ошибку, чтобы UI снял состояние "Думаю..."
        onMessageRef.current({ type: "error", message: "Соединение прервано. Пытаюсь переподключиться..." });
        
        // Авто-переподключение через 3 сек
        if (!destroyed) {
          reconnectRef.current = setTimeout(connect, 3_000);
        }
      };

      socket.onerror = () => {
        setConnected(false);
        socket.close();
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          // Игнорируем pong
          if ((msg as any).type === "pong") return;
          onMessageRef.current(msg);
        } catch {}
      };
    }

    connect();

    return () => {
      destroyed = true;
      if (pingRef.current) clearInterval(pingRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      ws.current?.close();
    };
  }, []);

  const send = useCallback((data: object | ArrayBuffer) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      if (data instanceof ArrayBuffer) {
        ws.current.send(data);
      } else {
        ws.current.send(JSON.stringify(data));
      }
    }
  }, []);

  return { send, connected };
}
