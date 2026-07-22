/**
 * Talmud daf/amud address parsing (SPEC §9). Consumes the address tokens
 * resolveWork left behind — which are RAW and unfolded, gershayim intact — and
 * produces a validated { daf, amud } or a typed rejection.
 *
 * The delicate part is that a trailing Hebrew letter is AMBIGUOUS: in כ״ב it is
 * the numeral bet (22), in ע״ב it is amud bet. So a bare Hebrew numeral with no
 * ayin-marker and no dot/colon is a daf with NO amud, and is rejected — never
 * silently read as amud b. Latin has no such ambiguity: a trailing a/b after
 * digits is the amud.
 */
import { parseGematria } from "./gematria";
import type { DafAmudRange, RefError, RefErrorCode, WorkEntry } from "./types";

type Amud = "a" | "b";

function fail(code: RefErrorCode, input: string, message: string): RefError {
  return { code, input, message };
}

/** "alef"/"aleph"/"a"/"א" → a; "bet"/"beis"/"beit"/"b"/"ב" → b. */
function amudWord(token: string): Amud | null {
  const t = token.replace(/[׳״'"]/g, "").toLowerCase().trim();
  if (["alef", "aleph", "a", "א"].includes(t)) return "a";
  if (["bet", "beis", "beit", "b", "ב"].includes(t)) return "b";
  return null;
}

/**
 * Pull the amud off the END of the address string, returning it and the daf
 * text that remains. Rules are ordered most-specific first; a Latin a/b is
 * accepted only when the rest is Arabic digits, so it can never eat a Hebrew
 * numeral's final letter.
 */
function extractAmud(s: string): { amud: Amud | null; rest: string } {
  // 1. word form: "… amud alef/bet/a/b"
  const word = s.match(/[\s,]*(?:amud|עמוד)\s+(\S+)\s*$/iu);
  if (word) {
    const amud = amudWord(word[1]);
    if (amud) return { amud, rest: s.slice(0, word.index).trim() };
  }
  // 2. Hebrew ayin-marker: ע (+ optional gershayim/geresh) then א/ב
  const ayin = s.match(/\s*ע["״׳']?\s*([אב])\s*$/u);
  if (ayin) return { amud: ayin[1] === "א" ? "a" : "b", rest: s.slice(0, ayin.index).trim() };
  // 3. Latin letter a/b, ONLY when the rest is Arabic digits. A trailing period
  //    is tolerated here as sentence punctuation ("19a."), NOT as the amud dot —
  //    the Latin letter already fixed the amud. Checked BEFORE the dot rule so
  //    that period is not misread as amud a.
  const latin = s.match(/^(\d+)\s*([ab])\s*\.?$/i);
  if (latin) return { amud: latin[2].toLowerCase() as Amud, rest: latin[1] };
  // 4. dot/colon shorthand for a Hebrew or bare-digit daf: one dot = a, colon = b.
  const dot = s.match(/\s*([.:])\s*$/);
  if (dot) return { amud: dot[1] === "." ? "a" : "b", rest: s.slice(0, dot.index).trim() };
  return { amud: null, rest: s.trim() };
}

/** Daf from Arabic digits or a Hebrew gematria numeral; null if neither. */
function parseDaf(rest: string): number | null {
  const t = rest.trim();
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  return parseGematria(t);
}

export function parseDafAmud(
  entry: WorkEntry,
  addressTokens: readonly string[],
  input: string,
): { daf: number; amud: Amud } | RefError {
  const range = entry.range as DafAmudRange;
  // Drop a leading "דף"/"daf" marker, then rejoin — commas were already turned
  // to spaces by the tokenizer, so this is a plain space-joined address.
  const tokens = [...addressTokens];
  if (tokens[0] && /^(דף|daf)$/i.test(tokens[0])) tokens.shift();
  const s = tokens.join(" ").trim();
  if (!s) return fail("MISSING_AMUD", input, "no daf or amud given");

  const { amud, rest } = extractAmud(s);
  const daf = parseDaf(rest);

  if (amud === null) {
    if (daf !== null) return fail("MISSING_AMUD", input, "a daf needs an amud (a/b, .:, ע״א/ע״ב)");
    if (/^\d+\s*[a-z]$/i.test(rest)) return fail("AMUD_INVALID", input, "amud is only a or b");
    return fail("MALFORMED_LOCATOR", input, `could not read a Talmud address from "${s}"`);
  }
  if (daf === null) return fail("MALFORMED_LOCATOR", input, `could not read a daf from "${rest}"`);

  // Daf ALWAYS starts at 2 — leaf 1 is the shaar/title page, Gemara opens on 2a.
  if (daf < 2) return fail("DAF_OUT_OF_RANGE", input, "daf starts at 2 (there is no 1)");
  if (daf > range.maxDaf) {
    return fail("DAF_OUT_OF_RANGE", input, `${entry.canonical} ends at daf ${range.maxDaf}`);
  }
  // A tractate whose last daf has only amud a has no final "b".
  if (daf === range.maxDaf && range.lastDafAmud === "a" && amud === "b") {
    return fail("DAF_OUT_OF_RANGE", input, `${entry.canonical} ends on ${range.maxDaf}a`);
  }
  return { daf, amud };
}
