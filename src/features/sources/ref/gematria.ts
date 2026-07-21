/**
 * Hebrew gematria numerals — the shared codec for every ref locator (daf,
 * perek, pasuk, siman, se'if, halacha). Pure and dependency-free.
 *
 * Gematria is purely ADDITIVE, written high-to-low: 19 = י(10)+ט(9) = יט,
 * 157 = ק(100)+נ(50)+ז(7) = קנז. There is no Roman-style subtraction.
 *
 * Two forms are special-cased BOTH directions because the naive letters spell a
 * Divine Name: 15 is ט״ו (9+6), never י״ה (10+5); 16 is ט״ז (9+7), never י״ו.
 * These are the only substitutions, and they ride along in larger numbers too —
 * 115 = קט״ו, 215 = רט״ו.
 *
 * Scope: values 1..999 — every source locator fits (a daf, chapter, siman all
 * stay well under 1000). Thousands (year dates) are deliberately out of scope.
 *
 * This lives in the sources feature because sources is its only caller today.
 * If a second consumer appears (search, a date helper), promote it to
 * shared_kernel — it is exactly the "boring, stable, Hebrew" shape that belongs
 * there, kept local only to avoid growing the kernel speculatively.
 */

// Sofit (final) forms carry the SAME value as their base for numeral purposes:
// ך=כ=20, ם=מ=40, ן=נ=50, ף=פ=80, ץ=צ=90. Folded before summing.
const LETTER_VALUE: ReadonlyMap<string, number> = new Map([
  ["א", 1], ["ב", 2], ["ג", 3], ["ד", 4], ["ה", 5], ["ו", 6], ["ז", 7], ["ח", 8], ["ט", 9],
  ["י", 10], ["כ", 20], ["ך", 20], ["ל", 30], ["מ", 40], ["ם", 40], ["נ", 50], ["ן", 50],
  ["ס", 60], ["ע", 70], ["פ", 80], ["ף", 80], ["צ", 90], ["ץ", 90],
  ["ק", 100], ["ר", 200], ["ש", 300], ["ת", 400],
]);

// Marks that TAG a letter-string as a number rather than a word — geresh ׳
// (U+05F3) and gershayim ״ (U+05F4), plus the ASCII substitutes users type
// (' and "). Stripped before summing; re-emitted on output.
const NUMERAL_MARKS = /['"׳״]/g;

/**
 * Parse a Hebrew numeral to an integer, or null if it is not a well-formed one.
 * Lenient by design: accepts sofit letters and ASCII marks, and accepts any
 * additive spelling that sums correctly (so an input "טו" or a hypothetical
 * "יה" both read as 15 — the forbidden-form rule is an OUTPUT concern). Returns
 * null for empty input or any unrecognized character, so a caller can treat
 * null as "not a Hebrew number" without a throw.
 */
export function parseGematria(input: string): number | null {
  const letters = input.replace(NUMERAL_MARKS, "").trim();
  if (letters.length === 0) return null;
  let sum = 0;
  for (const ch of letters) {
    const value = LETTER_VALUE.get(ch);
    if (value === undefined) return null;
    sum += value;
  }
  return sum;
}

const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const UNITS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];

/**
 * Render an integer (1..999) as a Hebrew numeral WITH its geresh/gershayim mark:
 * a lone letter takes a trailing geresh (2 → ב׳), a multi-letter numeral takes
 * gershayim before its final letter (19 → י״ט, 105 → ק״ה).
 *
 * Throws on out-of-range input: a locator that is 0, negative, or ≥1000 is a
 * programmer error upstream (the numeric validators reject bad user values long
 * before formatting), not something to paper over with a wrong glyph.
 */
export function formatGematria(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) {
    throw new RangeError(`gematria out of range (1..999): ${n}`);
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  let restLetters: string;
  if (rest === 15) {
    restLetters = "טו"; // never י״ה
  } else if (rest === 16) {
    restLetters = "טז"; // never י״ו
  } else {
    restLetters = TENS[Math.floor(rest / 10)] + UNITS[rest % 10];
  }

  const letters = HUNDREDS[hundreds] + restLetters;
  if (letters.length === 1) return `${letters}׳`; // geresh
  return `${letters.slice(0, -1)}״${letters.slice(-1)}`; // gershayim before last
}
