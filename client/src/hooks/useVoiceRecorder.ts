import { useState, useRef, useCallback } from "react";

export function useVoiceRecorder(
  onChunk: (chunk: ArrayBuffer) => void,
  onStop: () => void,
  onError?: (err: any) => void
) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Microphone API not supported in this browser/environment.");
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;

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
        stream.current?.getTracks().forEach(t => t.stop());
        onStop();
      };

      mr.onerror = (e) => {
        console.error("MediaRecorder error:", e);
        if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
          try { mediaRecorder.current.stop(); } catch {}
        }
        setIsRecording(false);
        onError?.(e);
      };

      mr.start(250); // chunk every 250ms
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      onError?.(err);
    }
  }, [onChunk, onStop, onError]);

  const stop = useCallback(() => {
    try {
      if (mediaRecorder.current && mediaRecorder.current.state !== "inactive") {
        mediaRecorder.current.stop();
      }
    } catch (err) {
      console.error("Error stopping MediaRecorder:", err);
    } finally {
      setIsRecording(false);
    }
  }, []);

  return { isRecording, start, stop };
}
