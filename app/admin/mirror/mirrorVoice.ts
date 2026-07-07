import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import { formatMirrorDueLabel } from "./mirrorTasks";

const WAKE_PHRASES = ["hey mirror", "mirror mirror"] as const;
const FOLLOW_UP_MS = 8000;

export type MirrorVoiceStatus =
  | "unsupported"
  | "needs-permission"
  | "listening"
  | "awake"
  | "speaking"
  | "error";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export type MirrorVoiceContext = {
  now: Date;
  weather: MirrorWeather | null;
  dueTasks: TaskRow[];
};

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function transcriptHasWakePhrase(text: string): boolean {
  const n = normalizeSpeech(text);
  return WAKE_PHRASES.some((phrase) => n.includes(phrase));
}

export function stripWakePhrases(text: string): string {
  let n = normalizeSpeech(text);
  for (const phrase of WAKE_PHRASES) {
    n = n.replaceAll(phrase, " ");
  }
  return n.replace(/\s+/g, " ").trim();
}

function formatSpokenTime(now: Date): string {
  return now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSpokenDate(now: Date): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function buildMirrorVoiceResponse(
  command: string,
  ctx: MirrorVoiceContext
): string {
  const c = normalizeSpeech(command);

  if (
    !c ||
    c.includes("help") ||
    c === "mirror" ||
    c.includes("hello") ||
    c.includes("hi mirror")
  ) {
    return "Try asking for the time, weather, or your tasks.";
  }

  if (c.includes("time") || c.includes("what hour")) {
    return `It's ${formatSpokenTime(ctx.now)}.`;
  }

  if (c.includes("date") || c.includes("what day")) {
    return `Today is ${formatSpokenDate(ctx.now)}.`;
  }

  if (c.includes("weather") || c.includes("temperature") || c.includes("forecast")) {
    if (!ctx.weather) return "Weather is unavailable right now.";
    return `${ctx.weather.temperatureF} degrees and ${ctx.weather.condition.toLowerCase()} in ${ctx.weather.location}. High ${ctx.weather.highF}, low ${ctx.weather.lowF}.`;
  }

  if (
    c.includes("task") ||
    c.includes("todo") ||
    c.includes("due") ||
    c.includes("to do")
  ) {
    if (ctx.dueTasks.length === 0) return "You have no tasks due today.";
    const first = ctx.dueTasks.slice(0, 3);
    const lines = first.map((t) => {
      const label = formatMirrorDueLabel(t, ctx.now);
      return `${t.title}, ${label.toLowerCase()}`;
    });
    const rest = ctx.dueTasks.length - first.length;
    const suffix = rest > 0 ? ` Plus ${rest} more.` : "";
    return `You have ${ctx.dueTasks.length} due tasks. ${lines.join(". ")}.${suffix}`;
  }

  return "I didn't catch that. Try time, weather, or tasks.";
}

export function speakMirrorResponse(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function getMirrorSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export type MirrorVoiceController = {
  start: () => void;
  stop: () => void;
};

export function createMirrorVoiceController(
  getContext: () => MirrorVoiceContext,
  onStatus: (status: MirrorVoiceStatus) => void
): MirrorVoiceController | null {
  const recognition = getMirrorSpeechRecognition();
  if (!recognition) {
    onStatus("unsupported");
    return null;
  }

  let running = false;
  let awakeUntil = 0;
  let speaking = false;
  let restartTimer: number | null = null;

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  const setStatus = () => {
    if (speaking) {
      onStatus("speaking");
      return;
    }
    if (Date.now() < awakeUntil) {
      onStatus("awake");
      return;
    }
    onStatus("listening");
  };

  const respond = async (text: string) => {
    speaking = true;
    onStatus("speaking");
    await speakMirrorResponse(text);
    speaking = false;
    awakeUntil = 0;
    setStatus();
  };

  const handleTranscript = async (raw: string, isFinal: boolean) => {
    if (!raw.trim() || speaking) return;

    const hasWake = transcriptHasWakePhrase(raw);
    const command = stripWakePhrases(raw);
    const awake = Date.now() < awakeUntil;

    if (hasWake) {
      awakeUntil = Date.now() + FOLLOW_UP_MS;
      setStatus();
      if (isFinal && command) {
        await respond(buildMirrorVoiceResponse(command, getContext()));
      } else if (isFinal && !command) {
        await respond("Yes?");
      }
      return;
    }

    if (awake && isFinal && command) {
      awakeUntil = 0;
      await respond(buildMirrorVoiceResponse(command, getContext()));
    }
  };

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += piece;
      else interim += piece;
    }
    if (finalText) void handleTranscript(finalText, true);
    else if (interim) void handleTranscript(interim, false);
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      onStatus("needs-permission");
      running = false;
      return;
    }
    if (event.error === "no-speech" || event.error === "aborted") return;
    onStatus("error");
  };

  recognition.onend = () => {
    if (!running) return;
    if (restartTimer != null) window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(() => {
      if (!running) return;
      try {
        recognition.start();
        setStatus();
      } catch {
        /* ignore restart race */
      }
    }, 250);
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      try {
        recognition.start();
        onStatus("listening");
      } catch {
        onStatus("needs-permission");
        running = false;
      }
    },
    stop: () => {
      running = false;
      awakeUntil = 0;
      if (restartTimer != null) window.clearTimeout(restartTimer);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      onStatus("needs-permission");
    },
  };
}
