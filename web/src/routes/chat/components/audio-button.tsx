import { AudioLinesIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "../../../auth";

const MAX_RECORDING_TIME = 900;
const MIN_RECORDING_TIME = 1;
const RECORDING_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/wav",
];

const RECORDING_STATE = {
  IDLE: "idle",
  RECORDING: "recording",
  PROCESSING: "processing",
  ERROR: "error",
} as const;

type RecordingState = (typeof RECORDING_STATE)[keyof typeof RECORDING_STATE];
type TranscriptionErrorType =
  | "network"
  | "permission"
  | "unsupported"
  | "transcription"
  | "unknown";
type TranscriptionError = Error & { type: TranscriptionErrorType };

function createTranscriptionError(
  message: string,
  type: TranscriptionErrorType,
): TranscriptionError {
  return Object.assign(new Error(message), { type });
}

function normalizeTranscriptionError(
  error: unknown,
  message: string,
  type: TranscriptionErrorType,
): TranscriptionError {
  if (
    error instanceof Error &&
    "type" in error &&
    ["network", "permission", "unsupported", "transcription", "unknown"].includes(
      String(error.type),
    )
  ) {
    return error as TranscriptionError;
  }
  return createTranscriptionError(error instanceof Error ? error.message : message, type);
}

function getRecordingMimeType(): string {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw createTranscriptionError(
      "Your browser doesn't support audio recording",
      "unsupported",
    );
  }

  const mimeType = RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    throw createTranscriptionError("No supported audio format available", "unsupported");
  }
  return mimeType;
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

function getAudioFilename(mimeType: string): string {
  switch (mimeType.split(";", 1)[0]) {
    case "audio/mp4":
      return "recording.m4a";
    case "audio/ogg":
      return "recording.ogg";
    case "audio/wav":
      return "recording.wav";
    default:
      return "recording.webm";
  }
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("audio", audioBlob, getAudioFilename(audioBlob.type));

  let response: Response;
  try {
    response = await authenticatedFetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
  } catch {
    throw createTranscriptionError("Network error during transcription", "network");
  }

  if (!response.ok) {
    throw createTranscriptionError(
      `Transcription failed: ${response.status} ${response.statusText}`,
      response.status >= 500 ? "network" : "transcription",
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw createTranscriptionError("Invalid transcription response", "transcription");
  }
  if (
    typeof result !== "object" ||
    result === null ||
    !("transcript" in result) ||
    typeof result.transcript !== "string"
  ) {
    throw createTranscriptionError("Invalid transcription response", "transcription");
  }
  return result.transcript;
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type AudioButtonProps = {
  onTranscript: (transcript: string) => void;
  onError: (error: TranscriptionError) => void;
};

const AudioButton: React.FC<AudioButtonProps> = ({ onTranscript, onError }) => {
  const [state, setState] = useState<RecordingState>(RECORDING_STATE.IDLE);
  const [recordingTime, setRecordingTime] = useState(0);

  const disposedRef = useRef(false);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearRecording() {
    clearTimer();
    stopStream();
    recorderRef.current = null;
    recordingStartTimeRef.current = null;
  }

  function reportError(error: TranscriptionError) {
    if (disposedRef.current) return;
    setState(RECORDING_STATE.ERROR);
    onError(error);
  }

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startRecording() {
    let mimeType: string;
    try {
      mimeType = getRecordingMimeType();
    } catch (error) {
      reportError(
        normalizeTranscriptionError(error, "Audio recording is unsupported", "unsupported"),
      );
      return;
    }

    setState(RECORDING_STATE.RECORDING);
    const permissionStatus = await checkMicrophonePermission();
    if (disposedRef.current) return;
    if (permissionStatus === "denied") {
      reportError(
        createTranscriptionError(
          "Microphone permission denied. Please allow microphone access in your browser settings and try again.",
          "permission",
        ),
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const recordingTime = recordingStartTimeRef.current
          ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
          : 0;
        clearRecording();
        if (disposedRef.current) return;

        if (recordingTime < MIN_RECORDING_TIME) {
          reportError(
            createTranscriptionError(
              `Recording too short. Minimum ${MIN_RECORDING_TIME} second(s) required.`,
              "unknown",
            ),
          );
          return;
        }

        setState(RECORDING_STATE.PROCESSING);
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || mimeType,
        });
        try {
          const transcript = await transcribeAudio(audioBlob);
          if (disposedRef.current) return;
          setState(RECORDING_STATE.IDLE);
          onTranscript(transcript);
        } catch (error) {
          reportError(
            normalizeTranscriptionError(error, "Transcription failed", "transcription"),
          );
        }
      };

      mediaRecorder.onerror = () => {
        mediaRecorder.onstop = null;
        clearRecording();
        reportError(createTranscriptionError("Recording failed", "unknown"));
      };

      recordingStartTimeRef.current = Date.now();
      mediaRecorder.start();
      setRecordingTime(0);
      clearTimer();
      timerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current === null) return;
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingTime(Math.min(elapsed, MAX_RECORDING_TIME));
        if (elapsed >= MAX_RECORDING_TIME) {
          stopRecording();
        }
      }, 1000);
    } catch (error) {
      clearRecording();
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        reportError(
          createTranscriptionError(
            "Microphone permission denied. Please allow microphone access and try again.",
            "permission",
          ),
        );
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        reportError(
          createTranscriptionError(
            "No microphone found. Please connect a microphone and try again.",
            "unknown",
          ),
        );
      } else if (error instanceof DOMException && error.name === "NotReadableError") {
        reportError(
          createTranscriptionError(
            "Microphone is being used by another application.",
            "unknown",
          ),
        );
      } else {
        reportError(
          normalizeTranscriptionError(error, "Failed to start recording", "unknown"),
        );
      }
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") {
      setState(RECORDING_STATE.PROCESSING);
      clearTimer();
      recorder.stop();
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
