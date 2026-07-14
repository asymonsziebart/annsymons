import { normalizeSpeech } from "./mirrorWakeTraining";

/** Common SpeechRecognition mishearings of "mirror". */
const MIRROR_EXACT = new Set([
  "mirror",
  "mirrors",
  "mira",
  "mirra",
  "meer",
  "mere",
  "mear",
  "miro",
  "miroir",
  "murmur",
  "mirrer",
  "mirer",
  "myrra",
  "myra",
]);

const HEY_EXACT = new Set(["hey", "hi", "hay", "a", "he"]);

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
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

/** True if a single spoken word is likely "mirror". */
export function isMirrorLikeWord(word: string): boolean {
  const w = normalizeSpeech(word);
  if (!w) return false;
  if (MIRROR_EXACT.has(w)) return true;
  if (w.startsWith("mir") && w.length >= 3 && w.length <= 8) return true;
  if (similarity(w, "mirror") >= 0.7) return true;
  return false;
}

export function isHeyLikeWord(word: string): boolean {
  const w = normalizeSpeech(word);
  return HEY_EXACT.has(w);
}

export function isBareMirrorTranscript(text: string): boolean {
  const words = normalizeSpeech(text).split(" ").filter(Boolean);
  return words.length === 1 && isMirrorLikeWord(words[0]);
}

/**
 * Detect wake even when Chrome/Android hears "mira mira", "mere mere", etc.
 * Returns which style matched for stripping.
 */
export function detectWakeInTranscript(text: string): {
  hasWake: boolean;
  command: string;
} {
  const n = normalizeSpeech(text);
  if (!n) return { hasWake: false, command: "" };

  const words = n.split(" ").filter(Boolean);

  // Exact / near-exact multiword phrases
  if (n.includes("hey mirror") || n.includes("mirror mirror")) {
    const command = n
      .replace(/hey\s+mirror/g, " ")
      .replace(/mirror\s*mirror/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { hasWake: true, command };
  }
  if (n.replace(/\s+/g, "") === "mirrormirror") {
    return { hasWake: true, command: "" };
  }

  // Two consecutive mirror-like words → "mirror mirror"
  for (let i = 0; i < words.length - 1; i++) {
    if (isMirrorLikeWord(words[i]) && isMirrorLikeWord(words[i + 1])) {
      const command = words.slice(i + 2).join(" ");
      return { hasWake: true, command };
    }
  }

  // hey/hi + mirror-like
  for (let i = 0; i < words.length - 1; i++) {
    if (isHeyLikeWord(words[i]) && isMirrorLikeWord(words[i + 1])) {
      const command = words.slice(i + 2).join(" ");
      return { hasWake: true, command };
    }
  }

  // Lone mirror-like word
  if (words.length === 1 && isMirrorLikeWord(words[0])) {
    return { hasWake: true, command: "" };
  }

  // Leading mirror-like word + command ("mirror what time is it")
  if (words.length >= 2 && isMirrorLikeWord(words[0]) && !isMirrorLikeWord(words[1])) {
    return { hasWake: true, command: words.slice(1).join(" ") };
  }

  return { hasWake: false, command: n };
}

export function isAndroidBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}
