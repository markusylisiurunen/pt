import { AudioLinesIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

async function transcribeAudio(audioBlob: Blob) {
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

  throw new Error(`Transcription failed: ${resp.status} ${resp.statusText}`);
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

type AudioButtonProps = {
  onTranscript: (transcript: string) => void;
};
const AudioButton: React.FC<AudioButtonProps> = ({ onTranscript }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

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
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

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

      const audioBlob = new Blob(chunksRef.current, { type: "audio/wav" });

      const transcript = await transcribeAudio(audioBlob);
      onTranscript(transcript);
    };

    mediaRecorder.start();

    setIsRecording(true);
    setRecordingTime(0);

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }

  function stopRecording() {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop();
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }

  function handleClick() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  return (
    <button id="audio" data-recording={isRecording ? true : undefined} onClick={handleClick}>
      {isRecording ? (
        <div className="audio-button-timer">
          <span>Nauhoitetaan...</span>
          <span>{formatTime(recordingTime)}</span>
        </div>
      ) : null}
      {!isRecording ? <AudioLinesIcon size={19} strokeWidth={2} /> : null}
    </button>
  );
};

export { AudioButton };
