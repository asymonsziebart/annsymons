import type { TaskRow } from "@/lib/data/taskClientTypes";
import type { MirrorWeather } from "@/lib/mirrorWeather";
import { isQuietCommand, isStopListeningCommand } from "./mirrorCommandParse";
import { formatMirrorDueLabel } from "./mirrorTasks";
import { speakJarvis, stopJarvisSpeech } from "./mirrorJarvisSpeak";
import {
  getTrainingSamples,
  normalizeSpeech,
  transcriptMatchesSample,
  type MirrorWakeTraining,
} from "./mirrorWakeTraining";

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

function normalizeSpeechLocal(text: string): string {
  return normalizeSpeech(text);
}

export function transcriptHasWakePhrase(text: string, training?: MirrorWakeTraining): boolean {
  const n = normalizeSpeechLocal(text);
  if (WAKE_PHRASES.some((phrase) => n.includes(phrase))) return true;
  if (n === "mirror" || n.startsWith("hey mirror")) return true;
  if (n.startsWith("mirror ") && !n.startsWith("mirror mirror")) return true;
  if (!training) return false;
  return getTrainingSamples(training).some((sample) => transcriptMatchesSample(n, sample));
}

function stripMatchedSample(text: string, sample: string): string {
  const n = normalizeSpeechLocal(text);
  const s = normalizeSpeechLocal(sample);
  if (!s) return n;
  if (n.includes(s)) return n.replace(s, " ").replace(/\s+/g, " ").trim();
  return n;
}

export function stripWakePhrases(text: string, training?: MirrorWakeTraining): string {
  let n = normalizeSpeechLocal(text);
  for (const phrase of WAKE_PHRASES) {
    n = n.replaceAll(phrase, " ");
  }
  if (n.startsWith("hey mirror ")) n = n.slice("hey mirror ".length);
  else if (n === "hey mirror") n = "";
  else if (n.startsWith("mirror ") && !n.startsWith("mirror mirror ")) n = n.slice("mirror ".length);
  else if (n === "mirror") n = "";
  if (training) {
    for (const sample of getTrainingSamples(training)) {
      n = stripMatchedSample(n, sample);
      if (transcriptMatchesSample(n, sample) && n.split(" ").length <= sample.split(" ").length + 1) {
        n = "";
      }
    }
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
  const c = normalizeSpeechLocal(command);

  if (
    !c ||
    c.includes("help") ||
    c === "mirror" ||
    c.includes("hello") ||
    c.includes("hi mirror")
  ) {
    return "Try asking for the time, weather, tasks, add a task, a recipe, a timer, or fullscreen.";
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

  if (c.includes("recipe")) {
    return 'Try saying "show me the recipe for" and the recipe name from your collection.';
  }

  return "I didn't catch that. Try time, weather, tasks, add a task, a recipe, or a timer.";
}

export type MirrorRecipeVoiceHandler = {
  handle: (raw: string, command: string) => string | null | Promise<string | null>;
};

/** Side-effect commands (fullscreen, timers, complete task). Return null if unmatched. */
export type MirrorActionVoiceHandler = {
  handle: (raw: string, command: string) => string | null | Promise<string | null>;
};

export function speakMirrorResponse(text: string): Promise<void> {
  return new Promise((resolve) => {
    speakJarvis(text, resolve);
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
  pause: () => void;
  resume: () => void;
};

export function createMirrorVoiceController(
  getContext: () => MirrorVoiceContext,
  getTraining: () => MirrorWakeTraining,
  onStatus: (status: MirrorVoiceStatus) => void,
  getRecipeHandler?: () => MirrorRecipeVoiceHandler | null,
  getActionHandler?: () => MirrorActionVoiceHandler | null
): MirrorVoiceController | null {
  const recognition = getMirrorSpeechRecognition();
  if (!recognition) {
    onStatus("unsupported");
    return null;
  }

  let running = false;
  let paused = false;
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
    if (!raw.trim()) return;

    const hasWake = transcriptHasWakePhrase(raw, getTraining());
    const command = stripWakePhrases(raw, getTraining());
    const awake = Date.now() < awakeUntil;
    const interruptText = command || normalizeSpeechLocal(raw);

    // Quiet / stop listening work even while Jarvis is speaking.
    if (isFinal && (isQuietCommand(interruptText) || isQuietCommand(raw))) {
      stopJarvisSpeech();
      speaking = false;
      awakeUntil = 0;
      setStatus();
      return;
    }

    if (isFinal && (isStopListeningCommand(interruptText) || isStopListeningCommand(raw))) {
      stopJarvisSpeech();
      speaking = false;
      awakeUntil = 0;
      running = false;
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      onStatus("needs-permission");
      return;
    }

    if (speaking) return;

    if (isFinal && (hasWake || awake)) {
      const actionReply = await getActionHandler?.()?.handle(raw, command);
      if (actionReply !== null && actionReply !== undefined) {
        awakeUntil = Date.now() + FOLLOW_UP_MS;
        setStatus();
        await respond(actionReply);
        return;
      }
    }

    if (isFinal) {
      const recipeReply = await getRecipeHandler?.()?.handle(raw, command);
      if (recipeReply !== null && recipeReply !== undefined) {
        if (hasWake) awakeUntil = Date.now() + FOLLOW_UP_MS;
        else if (recipeReply) awakeUntil = Date.now() + FOLLOW_UP_MS;
        setStatus();
        await respond(recipeReply);
        return;
      }
    }

    if (hasWake) {
      awakeUntil = Date.now() + FOLLOW_UP_MS;
      setStatus();
      if (isFinal && command) {
        await respond(buildMirrorVoiceResponse(command, getContext()));
      } else if (isFinal && !command) {
        await respond("How may I help you?");
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
    if (!running || paused) return;
    if (restartTimer != null) window.clearTimeout(restartTimer);
    restartTimer = window.setTimeout(() => {
      if (!running || paused) return;
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
      paused = false;
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
      paused = false;
      awakeUntil = 0;
      if (restartTimer != null) window.clearTimeout(restartTimer);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      onStatus("needs-permission");
    },
    pause: () => {
      paused = true;
      if (restartTimer != null) window.clearTimeout(restartTimer);
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    },
    resume: () => {
      if (!running) return;
      paused = false;
      try {
        recognition.start();
        setStatus();
      } catch {
        onStatus("error");
      }
    },
  };
}
