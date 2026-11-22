"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Mic,
  Square,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Volume2,
} from "lucide-react";
import { transcribeComplaintAudioApi } from "@/lib/api/complaint-client";

export type SupportedLanguage = "mr" | "hi" | "en";

interface WhisperVoiceTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onLanguageDetected?: (lang: SupportedLanguage) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  name?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  hi: "Hindi (हिंदी)",
  mr: "Marathi (मराठी)",
  en: "English",
  mixed: "Mixed (मिश्र भाषा)",
};

/**
 * Detects Hindi, Marathi, English, or Mixed language.
 */
function detectScriptLanguage(text: string): "hi" | "mr" | "en" | "mixed" {
  const hasDevanagari = anyCharInRange(text, 0x0900, 0x097f);
  const hasLatin = /[a-zA-Z]/.test(text);

  if (hasDevanagari && hasLatin) {
    return "mixed";
  }

  if (hasDevanagari) {
    const marathiKeywords = [
      "आहे", "आहेत", "झाला", "झाली", "झाले", "कचरा", "खड्डा", "खड्डे",
      "पाणी", "रस्ता", "रस्ते", "गल्ली", "गल्लीत", "करा", "करावे",
      "आमच्या", "येथे", "नाही", "होते", "तक्रार", "पाहिजे", "लवकर",
      "माझं", "माझा", "माझे", "नाव", "मी", "सांगतो", "करतो", "काम", "द्या"
    ];
    for (const kw of marathiKeywords) {
      if (text.includes(kw)) return "mr";
    }
    return "hi";
  }

  return "en";
}

function anyCharInRange(str: string, min: number, max: number): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= min && code <= max) return true;
  }
  return false;
}

/**
 * Combines two text strings without repeating or duplicating overlapping words.
 */
function appendWithoutDuplicate(committed: string, incoming: string): string {
  const c = committed.trim();
  const inc = incoming.trim();
  if (!c) return inc;
  if (!inc) return c;

  // If incoming already contains or starts with committed, incoming is cumulative
  if (inc.startsWith(c) || inc.includes(c)) return inc;

  // If committed already ends with or contains incoming, avoid duplicate
  if (c.endsWith(inc) || c.includes(inc)) return c;

  // Check if overlapping suffix/prefix exists
  const cWords = c.split(/\s+/);
  const incWords = inc.split(/\s+/);

  for (let overlapLen = Math.min(cWords.length, incWords.length); overlapLen > 0; overlapLen--) {
    const cTail = cWords.slice(cWords.length - overlapLen).join(" ");
    const incHead = incWords.slice(0, overlapLen).join(" ");
    if (cTail.toLowerCase() === incHead.toLowerCase()) {
      return `${c} ${incWords.slice(overlapLen).join(" ")}`.trim();
    }
  }

  return `${c} ${inc}`;
}

/**
 * Encodes Float32 PCM samples into 16kHz 16-bit Mono WAV format.
 */
function encodeWavChunk(
  samples: Float32Array,
  inputSampleRate: number,
  targetSampleRate = 16000
): ArrayBuffer {
  const ratio = inputSampleRate / targetSampleRate;
  const newLength = Math.max(1, Math.round(samples.length / ratio));
  const pcm16 = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < samples.length; i++) {
      accum += samples[i];
      count++;
    }
    const sample = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    pcm16[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  const dataByteLen = pcm16.byteLength;
  const buffer = new ArrayBuffer(44 + dataByteLen);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + dataByteLen, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"
  // fmt chunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data chunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, dataByteLen, true);

  new Int16Array(buffer, 44).set(pcm16);
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Sarvam AI Saaras v4 Real-Time Voice Typist
 * - Strictly types words ONCE with a pause buffer (no duplicate typing)
 * - Single continuous row, words append one by one without newlines
 * - Hindi, Marathi, English & Mixed language support
 * - Only ONE Speak button when idle, ONE Stop button when recording
 */
export function WhisperVoiceTextarea({
  value,
  onChange,
  onBlur,
  onLanguageDetected,
  disabled = false,
  placeholder = "Describe the issue in detail, or click Speak in Hindi, Marathi, English, or Mixed...",
  required = false,
  rows = 5,
  name = "description",
}: WhisperVoiceTextareaProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [detectedLanguageBadge, setDetectedLanguageBadge] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pause buffer & accumulation refs
  const baseTextRef = useRef<string>("");
  const currentTextRef = useRef<string>(value);
  const committedTextRef = useRef<string>("");
  const currentLiveSegmentRef = useRef<string>("");
  const pauseCommitTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    currentTextRef.current = value;
  }, [value]);

  /**
   * Updates the textarea in ONE continuous row with de-duplication.
   */
  const renderCombinedText = useCallback(
    (livePhrase: string, detectedLang?: string) => {
      const base = baseTextRef.current.trim();
      const committed = committedTextRef.current.trim();
      const live = livePhrase.trim();

      // Combine committed session text with active live phrase (no duplicates)
      const sessionText = appendWithoutDuplicate(committed, live);

      // Join with prior base text (in ONE row with space, no newline)
      const fullText = base ? `${base} ${sessionText}`.trim() : sessionText.trim();
      onChange(fullText);

      if (detectedLang) {
        const formLang: SupportedLanguage =
          detectedLang === "mr" ? "mr" : detectedLang === "hi" ? "hi" : "en";
        onLanguageDetected?.(formLang);
        setDetectedLanguageBadge(`Detected: ${LANGUAGE_LABELS[detectedLang] || detectedLang}`);
      }
    },
    [onChange, onLanguageDetected]
  );

  /**
   * Handles incoming text from Sarvam AI WebSocket.
   * Uses a pause debounce (~750ms) so words settle once and never duplicate.
   */
  const handleLiveTranscript = useCallback(
    (incomingText: string, langCode?: string) => {
      const clean = incomingText.trim();
      if (!clean) return;

      currentLiveSegmentRef.current = clean;
      const detected = (langCode as any) || detectScriptLanguage(clean);

      // Render live in-place update (types once, continuous flow)
      renderCombinedText(clean, detected);

      // Reset pause commit timer: when user pauses for ~750ms, commit phrase
      if (pauseCommitTimerRef.current) {
        clearTimeout(pauseCommitTimerRef.current);
      }

      pauseCommitTimerRef.current = setTimeout(() => {
        if (currentLiveSegmentRef.current.trim()) {
          const phraseToCommit = currentLiveSegmentRef.current.trim();
          committedTextRef.current = appendWithoutDuplicate(
            committedTextRef.current,
            phraseToCommit
          );
          currentLiveSegmentRef.current = "";
          renderCombinedText("");
        }
      }, 750);
    },
    [renderCombinedText]
  );

  const cleanupAudioResources = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pauseCommitTimerRef.current) {
      clearTimeout(pauseCommitTimerRef.current);
      pauseCommitTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (processorNodeRef.current) {
      try {
        processorNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      processorNodeRef.current = null;
    }
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ action: "stop" }));
        }
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    audioChunksRef.current = [];
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      cleanupAudioResources();
    };
  }, [cleanupAudioResources]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  /**
   * 1. Start Speaking: Streaming to Sarvam AI with pause debounce
   */
  const startRecording = async () => {
    setErrorMessage(null);
    setDetectedLanguageBadge(null);

    // Keep prior text safe so new words append cleanly one by one
    baseTextRef.current = currentTextRef.current.trim();
    committedTextRef.current = "";
    currentLiveSegmentRef.current = "";
    audioChunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;
    } catch (err: any) {
      console.warn("Microphone access denied:", err);
      if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
        setErrorMessage("Microphone permission was denied. Please allow microphone in your browser to speak.");
      } else {
        setErrorMessage("Could not connect to microphone. Please check your audio input device.");
      }
      return;
    }

    // Connect WebSocket streaming to Sarvam AI Saaras v4 proxy
    const wsUrl = process.env.NEXT_PUBLIC_AI_WS_URL || "ws://localhost:8000/voice/stream";
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "transcript" && typeof data.transcript === "string") {
            const raw = data.transcript;
            if (raw && raw.trim()) {
              handleLiveTranscript(raw, data.language);
            }
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = (err) => {
        console.warn("[Sarvam Voice WS] Notice:", err);
      };
    } catch (wsErr) {
      console.warn("[Sarvam Voice WS] Init notice:", wsErr);
    }

    // Setup AudioContext for streaming ~200ms audio chunks to Sarvam AI
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        // Visualizer level loop
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVolume = () => {
          if (!analyser || audioCtx.state === "closed") return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();

        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        processorNodeRef.current = processor;
        source.connect(processor);
        processor.connect(audioCtx.destination);

        let accumulatedSamples: number[] = [];

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          if (!inputData || inputData.length === 0) return;

          for (let i = 0; i < inputData.length; i++) {
            accumulatedSamples.push(inputData[i]);
          }

          // Emit ~200ms chunks to Sarvam AI
          const targetSamples = Math.round(audioCtx.sampleRate * 0.2);
          if (accumulatedSamples.length >= targetSamples) {
            const floatArray = new Float32Array(accumulatedSamples);
            accumulatedSamples = [];

            const wavBuffer = encodeWavChunk(floatArray, audioCtx.sampleRate, 16000);
            const b64 = arrayBufferToBase64(wavBuffer);

            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "audio", data: b64 }));
            }
          }
        };
      }
    } catch (audioCtxErr) {
      console.warn("AudioContext setup notice:", audioCtxErr);
    }

    // MediaRecorder backup for fallback
    try {
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      recorder.start(250);
    } catch (recErr) {
      console.warn("MediaRecorder notice:", recErr);
    }

    setIsRecording(true);
    setRecordingSeconds(0);

    timerIntervalRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  /**
   * 2. Stop Speaking: Commit remaining words cleanly without duplication
   */
  const stopRecording = async () => {
    setIsRecording(false);
    setIsTranscribing(true);

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (pauseCommitTimerRef.current) {
      clearTimeout(pauseCommitTimerRef.current);
      pauseCommitTimerRef.current = null;
    }

    // Commit any active remaining words into committedText
    if (currentLiveSegmentRef.current.trim()) {
      committedTextRef.current = appendWithoutDuplicate(
        committedTextRef.current,
        currentLiveSegmentRef.current.trim()
      );
      currentLiveSegmentRef.current = "";
    }

    // Stop MediaRecorder
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
        try {
          recorder.stop();
        } catch {
          resolve();
        }
      });
    }

    // Stop WebSocket stream
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ action: "stop" }));
      } catch {
        // ignore
      }
    }

    // Check if any text was transcribed via WebSocket
    const sessionTranscribed = committedTextRef.current.trim();

    // If WebSocket stream was offline/empty, fallback to REST API
    if (!sessionTranscribed && audioChunksRef.current.length > 0) {
      try {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder?.mimeType || "audio/webm",
        });
        const audioFile = new File([audioBlob], `voice-complaint-${Date.now()}.webm`, {
          type: audioBlob.type,
        });

        const result = await transcribeComplaintAudioApi(audioFile);
        if (result && result.text && result.text.trim()) {
          const finalTranscript = result.text.trim();
          committedTextRef.current = appendWithoutDuplicate(
            committedTextRef.current,
            finalTranscript
          );
          renderCombinedText("", result.language);

          const lang = result.language || "en";
          setDetectedLanguageBadge(`Detected: ${LANGUAGE_LABELS[lang] || lang}`);
          setTimeout(() => setDetectedLanguageBadge(null), 6000);
        }
      } catch (err: any) {
        console.warn("Audio transcription fallback notice:", err);
        setErrorMessage(err?.message || "Could not transcribe audio. You can also type your description.");
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } else {
      // Finalize the combined text cleanly in ONE row
      renderCombinedText("");
      setTimeout(() => setDetectedLanguageBadge(null), 6000);
    }

    cleanupAudioResources();
    setIsTranscribing(false);
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Textarea Container with In-Textarea Controls */}
      <div className="relative w-full rounded-xl border border-[#CBD5E1] dark:border-[#2D3748] bg-white dark:bg-[#161F30] transition-all focus-within:border-[#0B4EA2] dark:focus-within:border-[#3B82F6] focus-within:ring-2 focus-within:ring-[#EAF2FF] dark:focus-within:ring-[#1E3A8A]">
        {/* Editable Text Area */}
        <textarea
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          required={required}
          rows={rows}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full p-3.5 pb-14 bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] resize-none"
        ></textarea>

        {/* Controls Toolbar INSIDE the bottom of the Text Area */}
        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
          {/* Left Side: Status / Timer / Detected Language / Waveform */}
          <div className="flex items-center gap-2 min-w-0">
            {isRecording ? (
              <div className="flex items-center gap-2">
                {/* Pulsing red recording dot */}
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                </span>

                {/* Animated sound wave bars */}
                <div className="flex items-center gap-0.5 h-3.5 px-0.5" title="Microphone level">
                  <div
                    className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, (audioLevel * 14) / 100)}px` }}
                  />
                  <div
                    className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, (audioLevel * 18) / 100)}px` }}
                  />
                  <div
                    className="w-0.5 bg-red-500 rounded-full transition-all duration-75"
                    style={{ height: `${Math.max(3, (audioLevel * 12) / 100)}px` }}
                  />
                </div>

                <span className="text-xs font-semibold text-red-600">
                  Listening ({formatTime(recordingSeconds)})
                </span>
                <span className="text-[11px] text-[#64748B] hidden sm:inline">
                  (typing in real time...)
                </span>
              </div>
            ) : isTranscribing ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B4EA2] animate-pulse">
                <Loader2 size={13} className="animate-spin" />
                <span>Transcribing voice note...</span>
              </div>
            ) : detectedLanguageBadge ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                <span>{detectedLanguageBadge}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-[#94A3B8]">
                <Volume2 size={13} className="shrink-0 text-[#0B4EA2]" />
                <span className="hidden sm:inline">
                  Hindi (हिंदी), Marathi (मराठी), English
                </span>
                <span className="sm:hidden">Hindi, Marathi, English</span>
              </div>
            )}
          </div>

          {/* Right Side: Only ONE Speak Button (idle) or ONE Stop Button (recording) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isRecording ? (
              /* Single Speak Button when Idle */
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled || isTranscribing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B4EA2] hover:bg-[#003875] text-white text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                title="Click to speak in Hindi, Marathi, or English"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Transcribing...</span>
                  </>
                ) : (
                  <>
                    <Mic size={14} />
                    <span>Speak</span>
                  </>
                )}
              </button>
            ) : (
              /* Single Stop Button when Recording */
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs active:scale-95"
                title="Stop recording"
              >
                <Square size={12} className="fill-white" />
                <span>Stop</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-lg">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
