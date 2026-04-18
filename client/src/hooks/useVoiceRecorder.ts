import { useState, useRef, useCallback } from "react";

export function useVoiceRecorder(
  onChunk: (chunk: ArrayBuffer) => void,
  onStop: () => void
) {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mr = new MediaRecorder(s, { mimeType });
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

      mr.start(250); // chunk every 250ms
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [onChunk, onStop]);

  const stop = useCallback(() => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, start, stop };
}
