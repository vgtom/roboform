import { Loader2, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudioForAiPrompt } from "wasp/client/operations";
import { useToast } from "../hooks/use-toast";
import { cn } from "../utils";
import { Button } from "./ui/button";

const MAX_RECORDING_MS = 120_000;

function pickRecorderMimeType(): string | undefined {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
  ];
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) {
      return c;
    }
  }
  return undefined;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        reject(new Error("Invalid data URL"));
      } else {
        resolve(base64);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export type AiVoicePromptButtonProps = {
  /** Called with Whisper transcript text; merge into your prompt in the parent. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Records microphone audio, sends it to the server for OpenAI Whisper (`whisper-1`) transcription,
 * then calls `onTranscript` with the text. User taps to start, taps again to stop (max ~2 min).
 */
export function AiVoicePromptButton({
  onTranscript,
  disabled,
  className,
}: AiVoicePromptButtonProps) {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopInFlightRef = useRef(false);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
      }
      cleanupStream();
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, [cleanupStream]);

  const stopRecordingAndSend = useCallback(async () => {
    if (stopInFlightRef.current) {
      return;
    }
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }

    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") {
      return;
    }

    stopInFlightRef.current = true; // held until transcribe finishes or blob too small

    const mimeType = mr.mimeType || "audio/webm";

    await new Promise<void>((resolve) => {
      mr.onstop = () => resolve();
      try {
        mr.stop();
      } catch {
        resolve();
      }
    });

    cleanupStream();
    setIsRecording(false);
    mediaRecorderRef.current = null;

    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    if (blob.size < 100) {
      stopInFlightRef.current = false;
      toast({
        title: "Recording too short",
        description: "Speak a bit longer, then tap again to stop.",
        variant: "destructive",
      });
      return;
    }

    setIsTranscribing(true);
    try {
      const audioBase64 = await blobToBase64(blob);
      const { text } = await transcribeAudioForAiPrompt({
        audioBase64,
        mimeType,
      });
      onTranscript(text);
    } catch (e: unknown) {
      toast({
        title: "Transcription failed",
        description: e instanceof Error ? e.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
      stopInFlightRef.current = false;
    }
  }, [cleanupStream, onTranscript, toast]);

  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing || disabled) {
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: "Not supported",
        description: "Your browser does not support microphone recording.",
        variant: "destructive",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMimeType();
      const mr = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      stopTimerRef.current = setTimeout(() => {
        void stopRecordingAndSend();
      }, MAX_RECORDING_MS);
    } catch {
      toast({
        title: "Microphone unavailable",
        description: "Allow microphone access in your browser to use voice input.",
        variant: "destructive",
      });
    }
  }, [disabled, isRecording, isTranscribing, stopRecordingAndSend, toast]);

  const handleClick = () => {
    if (isTranscribing || disabled) {
      return;
    }
    if (isRecording) {
      void stopRecordingAndSend();
    } else {
      void startRecording();
    }
  };

  return (
    <Button
      type="button"
      variant={isRecording ? "destructive" : "outline"}
      size="icon"
      className={cn(
        // Right edge of the textarea, vertically centered (top ↔ bottom)
        "absolute right-2 top-1/2 z-10 -translate-y-1/2 shrink-0",
        isRecording && "animate-pulse",
        className,
      )}
      disabled={disabled || isTranscribing}
      onClick={handleClick}
      title={
        isTranscribing
          ? "Transcribing…"
          : isRecording
            ? "Tap to stop and transcribe"
            : "Voice: tap to start, tap again to stop (max ~2 min)"
      }
      aria-pressed={isRecording}
      aria-label={
        isRecording ? "Stop recording and transcribe" : "Start voice input"
      }
    >
      {isTranscribing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <Square className="h-4 w-4 fill-current" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );
}
