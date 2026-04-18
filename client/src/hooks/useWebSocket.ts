import { useEffect, useRef, useCallback, useState } from "react";

export type WSMessage =
  | { type: "session"; sessionId: number }
  | { type: "thinking" }
  | { type: "transcribing" }
  | { type: "transcript"; text: string }
  | { type: "text_response"; text: string; vocab: Array<{ word: string; translation: string; lang: string }> }
  | { type: "audio_response"; audio: string }
  | { type: "language_switched"; language: string }
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
