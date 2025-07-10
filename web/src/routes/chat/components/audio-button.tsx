import { AudioLinesIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const MAX_RECORDING_TIME = 900; // 15 minutes
const MIN_RECORDING_TIME = 1; // 1 second

const RECORDING_STATE = {
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  ERROR: "error",
} as const;

type RecordingState = (typeof RECORDING_STATE)[keyof typeof RECORDING_STATE];

interface TranscriptionError extends Error {
  type: "network" | "permission" | "unsupported" | "transcription" | "unknown";
}

function checkBrowserSupport(): { supported: boolean; error?: string } {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return {
      supported: false,
      error: "Your browser doesn't support audio recording",
    };
  }

  if (!window.MediaRecorder) {
    return {
      supported: false,
      error: "Your browser doesn't support MediaRecorder",
    };
  }

  return { supported: true };
}

async function checkMicrophonePermission(): Promise<PermissionState | null> {
  if ("permissions" in navigator && "query" in navigator.permissions) {
    try {
      const result = await navigator.permissions.query({
        name: "microphone" as PermissionName,
      });
      return result.state;
    } catch {
      return null;
    }
  }
  return null;
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    const resp = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
      headers: {
        authorization: `Bearer ${window.localStorage.getItem("token")}`,
      },
    });

    if (resp.ok) {
      const { transcript } = (await resp.json()) as { transcript: string };
      return transcript;
    }

    const error = new Error(
      `Transcription failed: ${resp.status} ${resp.statusText}`,
    ) as TranscriptionError;
    error.type = resp.status >= 500 ? "network" : "transcription";
    throw error;
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("fetch")) {
      const networkError = new Error("Network error during transcription") as TranscriptionError;
      networkError.type = "network";
      throw networkError;
    }
    throw err;
  }
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type AudioButtonProps = {
  onTranscript: (transcript: string) => void;
  onError?: (error: TranscriptionError) => void;
};

const AudioButton: React.FC<AudioButtonProps> = ({ onTranscript, onError }) => {
  const [state, setState] = useState<RecordingState>(RECORDING_STATE.IDLE);

  const [recordingTime, setRecordingTime] = useState(0);
  const recordingStartTimeRef = useRef<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function startRecording() {
    const browserSupport = checkBrowserSupport();
    if (!browserSupport.supported) {
      const error = new Error(browserSupport.error!) as TranscriptionError;
      error.type = "unsupported";
      onError?.(error);
      return;
    }

    const permissionStatus = await checkMicrophonePermission();
    if (permissionStatus === "denied") {
      const error = new Error(
        "Microphone permission denied. Please allow microphone access in your browser settings and try again.",
      ) as TranscriptionError;
      error.type = "permission";
      setState(RECORDING_STATE.ERROR);
      onError?.(error);
      return;
    }

    try {
      setState(RECORDING_STATE.RECORDING);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      if (
        !MediaRecorder.isTypeSupported("audio/webm") &&
        !MediaRecorder.isTypeSupported("audio/wav")
      ) {
        throw new Error("No supported audio format available");
      }

      const mediaRecorder = new MediaRecorder(stream);
      recorderRef.current = mediaRecorder;

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const actualRecordingTime = recordingStartTimeRef.current
          ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
          : recordingTime;

        if (actualRecordingTime < MIN_RECORDING_TIME) {
          const error = new Error(
            `Recording too short. Minimum ${MIN_RECORDING_TIME} second(s) required.`,
          ) as TranscriptionError;
          error.type = "unknown";
          setState(RECORDING_STATE.ERROR);
          onError?.(error);
          return;
        }

        try {
          setState(RECORDING_STATE.PROCESSING);
          const audioBlob = new Blob(chunksRef.current, { type: "audio/wav" });

          const transcript = await transcribeAudio(audioBlob);
          setState(RECORDING_STATE.IDLE);
          onTranscript(transcript);
        } catch (err) {
          const transcriptionError = err as TranscriptionError;
          setState(RECORDING_STATE.ERROR);
          onError?.(transcriptionError);
        }
      };

      mediaRecorder.onerror = () => {
        const error = new Error("Recording failed") as TranscriptionError;
        error.type = "unknown";
        setState(RECORDING_STATE.ERROR);
        onError?.(error);
      };

      mediaRecorder.start();

      setRecordingTime(0);
      recordingStartTimeRef.current = Date.now();

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
          }
          return newTime;
        });
      }, 1000);
    } catch (err) {
      let error: TranscriptionError;

      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError") {
          error = new Error(
            "Microphone permission denied. Please allow microphone access and try again.",
          ) as TranscriptionError;
          error.type = "permission";
        } else if (err.name === "NotFoundError") {
          error = new Error(
            "No microphone found. Please connect a microphone and try again.",
          ) as TranscriptionError;
          error.type = "unknown";
        } else if (err.name === "NotReadableError") {
          error = new Error(
            "Microphone is being used by another application.",
          ) as TranscriptionError;
          error.type = "unknown";
        } else {
          error = new Error(`Microphone error: ${err.message}`) as TranscriptionError;
          error.type = "unknown";
        }
      } else {
        error = new Error("Failed to start recording") as TranscriptionError;
        error.type = "unknown";
      }

      setState(RECORDING_STATE.ERROR);
      onError?.(error);
    }
  }

  function stopRecording() {
    if (recorderRef.current && state === RECORDING_STATE.RECORDING) {
      recorderRef.current.stop();
      setState(RECORDING_STATE.PROCESSING);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  function handleClick() {
    if (state === RECORDING_STATE.RECORDING) {
      stopRecording();
    } else if (state === RECORDING_STATE.IDLE || state === RECORDING_STATE.ERROR) {
      startRecording();
    }
  }

  const isRecording = state === RECORDING_STATE.RECORDING;
  const isProcessing = state === RECORDING_STATE.PROCESSING;
  const hasError = state === RECORDING_STATE.ERROR;

  return (
    <button
      id="audio"
      data-recording={isRecording || isProcessing ? true : undefined}
      data-error={hasError ? true : undefined}
      disabled={isProcessing}
      onClick={handleClick}
    >
      {isRecording ? (
        <div className="timer">
          <span>Nauhoitetaan... {formatTime(recordingTime)}</span>
        </div>
      ) : isProcessing ? (
        <div className="processing">
          <span>Käsitellään...</span>
        </div>
      ) : hasError ? (
        <div className="error">
          <span>Virhe</span>
        </div>
      ) : (
        <AudioLinesIcon size={20} strokeWidth={2} />
      )}
    </button>
  );
};

export { AudioButton };
