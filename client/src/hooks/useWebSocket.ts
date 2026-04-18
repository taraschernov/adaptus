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
  onMessageRef.current = onMessage;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        onMessageRef.current(msg);
      } catch {}
    };

    return () => socket.close();
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
