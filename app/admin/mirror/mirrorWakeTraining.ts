export type WakePhraseTarget = "hey_mirror" | "mirror_mirror";

export type MirrorWakeTraining = {
  heyMirror: string[];
  mirrorMirror: string[];
};

export const WAKE_PHRASE_TARGETS: { id: WakePhraseTarget; label: string; hint: string }[] = [
  { id: "hey_mirror", label: "Hey mirror", hint: "hey mirror" },
  { id: "mirror_mirror", label: "Mirror mirror", hint: "mirror mirror" },
];

export const TRAINING_SAMPLES_NEEDED = 4;
const STORAGE_KEY = "mirror-wake-training-v1";

export function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadMirrorWakeTraining(): MirrorWakeTraining {
  if (typeof window === "undefined") return { heyMirror: [], mirrorMirror: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { heyMirror: [], mirrorMirror: [] };
    const parsed = JSON.parse(raw) as Partial<MirrorWakeTraining>;
    return {
      heyMirror: Array.isArray(parsed.heyMirror)
        ? parsed.heyMirror.map(normalizeSpeech).filter(Boolean)
        : [],
      mirrorMirror: Array.isArray(parsed.mirrorMirror)
        ? parsed.mirrorMirror.map(normalizeSpeech).filter(Boolean)
        : [],
    };
  } catch {
    return { heyMirror: [], mirrorMirror: [] };
  }
}

export function saveMirrorWakeTraining(training: MirrorWakeTraining): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(training));
}

export function trainingKey(target: WakePhraseTarget): keyof MirrorWakeTraining {
  return target === "hey_mirror" ? "heyMirror" : "mirrorMirror";
}

export function addTrainingSample(
  target: WakePhraseTarget,
  heard: string,
  current: MirrorWakeTraining
): MirrorWakeTraining {
  const key = trainingKey(target);
  const normalized = normalizeSpeech(heard);
  if (!normalized) return current;
  const next = [...current[key], normalized].slice(-8);
  return { ...current, [key]: next };
}

export function clearTrainingTarget(
  target: WakePhraseTarget,
  current: MirrorWakeTraining
): MirrorWakeTraining {
  return { ...current, [trainingKey(target)]: [] };
}

export function clearAllTraining(): MirrorWakeTraining {
  const empty = { heyMirror: [], mirrorMirror: [] };
  saveMirrorWakeTraining(empty);
  return empty;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function wordsMatch(transcript: string, sample: string): boolean {
  const tWords = transcript.split(" ").filter(Boolean);
  const sWords = sample.split(" ").filter(Boolean);
  if (sWords.length === 0) return false;

  let matched = 0;
  for (const sw of sWords) {
    if (
      tWords.some(
        (tw) =>
          tw === sw ||
          tw.includes(sw) ||
          sw.includes(tw) ||
          similarity(tw, sw) >= 0.72
      )
    ) {
      matched += 1;
    }
  }
  return matched >= Math.max(1, Math.ceil(sWords.length * 0.6));
}

export function transcriptMatchesSample(transcript: string, sample: string): boolean {
  const t = normalizeSpeech(transcript);
  const s = normalizeSpeech(sample);
  if (!t || !s) return false;
  if (t.includes(s) || s.includes(t)) return true;
  if (similarity(t, s) >= 0.68) return true;
  return wordsMatch(t, s);
}

export function getTrainingSamples(training: MirrorWakeTraining): string[] {
  return [...training.heyMirror, ...training.mirrorMirror];
}

export function countTrainingSamples(
  training: MirrorWakeTraining,
  target?: WakePhraseTarget
): number {
  if (target === "hey_mirror") return training.heyMirror.length;
  if (target === "mirror_mirror") return training.mirrorMirror.length;
  return training.heyMirror.length + training.mirrorMirror.length;
}
