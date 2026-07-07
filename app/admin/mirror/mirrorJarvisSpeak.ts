type SpeechWindow = Window & {
  speechSynthesis: SpeechSynthesis;
};

let voicesReady = false;
let preferredVoice: SpeechSynthesisVoice | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;

const JARVIS_RATE = 0.9;
const JARVIS_PITCH = 0.82;

const VOICE_PREFS: RegExp[] = [
  /google uk english male/i,
  /daniel/i,
  /arthur/i,
  /en-gb/i,
  /english.*united kingdom/i,
  /google us english/i,
];

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return (window as SpeechWindow).speechSynthesis ?? null;
}

function pickJarvisVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const pref of VOICE_PREFS) {
    const match = voices.find((v) => pref.test(v.name) || pref.test(v.lang));
    if (match) return match;
  }
  return voices.find((v) => v.lang.startsWith("en")) ?? voices[0] ?? null;
}

function refreshPreferredVoice(): void {
  const synth = getSynth();
  if (!synth) return;
  const voices = synth.getVoices();
  if (voices.length === 0) return;
  preferredVoice = pickJarvisVoice(voices);
  voicesReady = true;
}

export function isJarvisSpeakSupported(): boolean {
  return getSynth() !== null;
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
  utterance.rate = JARVIS_RATE;
  utterance.pitch = JARVIS_PITCH;
  utterance.lang = preferredVoice?.lang ?? "en-GB";
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
  synth.speak(utterance);
}
