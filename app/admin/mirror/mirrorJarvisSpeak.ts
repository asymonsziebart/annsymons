type SpeechWindow = Window & {
  speechSynthesis: SpeechSynthesis;
};

let voicesReady = false;
let preferredVoice: SpeechSynthesisVoice | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

/** Natural conversational pacing — avoid the old low-pitch “robot Jarvis” settings. */
const SPEAK_RATE = 1;
const SPEAK_PITCH = 1;

/** Prefer warm, natural-sounding English voices available on Chrome / Android. */
const VOICE_BONUS: { test: RegExp; score: number }[] = [
  { test: /natural|neural|enhanced|premium|wavenet|studio|quality|online/i, score: 55 },
  { test: /google us english/i, score: 45 },
  { test: /google uk english female/i, score: 42 },
  { test: /samantha|karen|moira|victoria|susan|zira|fiona|tessa|karen/i, score: 40 },
  { test: /google.*english.*female/i, score: 38 },
  { test: /microsoft.*(aria|jenny|guy|sara)/i, score: 36 },
  { test: /samsung.*english|samsung.*us/i, score: 34 },
  { test: /en-us|en_us/i, score: 22 },
  { test: /en-gb|en_gb/i, score: 12 },
  { test: /english/i, score: 8 },
];

const VOICE_PENALTY: { test: RegExp; score: number }[] = [
  { test: /compact|eloquence|robot|novelty|whisper|zarvox|trinoids|bad news|good news|boing|bubbles/i, score: 40 },
  { test: /google uk english male/i, score: 18 },
  { test: /\bmale\b/i, score: 6 },
];

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return (window as SpeechWindow).speechSynthesis ?? null;
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  const hay = `${voice.name} ${voice.lang}`;
  let score = 0;

  if (!voice.lang.toLowerCase().startsWith("en")) score -= 120;

  for (const { test, score: bonus } of VOICE_BONUS) {
    if (test.test(hay)) score += bonus;
  }
  for (const { test, score: penalty } of VOICE_PENALTY) {
    if (test.test(hay)) score -= penalty;
  }

  // Prefer on-device voices when quality is comparable (more reliable on tablets).
  if (voice.localService) score += 4;

  return score;
}

function pickNaturalVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  const best = ranked[0];
  if (best && scoreVoice(best) > -50) return best;

  return voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? voices[0] ?? null;
}

function refreshPreferredVoice(): void {
  const synth = getSynth();
  if (!synth) return;
  const voices = synth.getVoices();
  if (voices.length === 0) return;
  preferredVoice = pickNaturalVoice(voices);
  voicesReady = true;
}

export function isJarvisSpeakSupported(): boolean {
  return getSynth() !== null;
}

export function getPreferredMirrorVoiceName(): string | null {
  return preferredVoice?.name ?? null;
}

export function bindJarvisVoices(): () => void {
  const synth = getSynth();
  if (!synth) return () => {};

  const onVoices = () => refreshPreferredVoice();
  refreshPreferredVoice();
  synth.addEventListener("voiceschanged", onVoices);
  return () => synth.removeEventListener("voiceschanged", onVoices);
}

export function stopJarvisSpeech(): void {
  const synth = getSynth();
  activeUtterance = null;
  synth?.cancel();
}

export function speakJarvis(text: string, onEnd?: () => void): void {
  const synth = getSynth();
  if (!synth || !text.trim()) {
    onEnd?.();
    return;
  }

  stopJarvisSpeech();

  if (!voicesReady) refreshPreferredVoice();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = SPEAK_RATE;
  utterance.pitch = SPEAK_PITCH;
  utterance.lang = preferredVoice?.lang ?? "en-US";
  if (preferredVoice) utterance.voice = preferredVoice;

  utterance.onend = () => {
    if (activeUtterance === utterance) activeUtterance = null;
    onEnd?.();
  };
  utterance.onerror = () => {
    if (activeUtterance === utterance) activeUtterance = null;
    onEnd?.();
  };

  activeUtterance = utterance;

  // Chrome sometimes drops the first utterance if speak() runs too early after cancel().
  window.setTimeout(() => {
    if (activeUtterance !== utterance) return;
    try {
      synth.speak(utterance);
    } catch {
      onEnd?.();
    }
  }, 40);
}
