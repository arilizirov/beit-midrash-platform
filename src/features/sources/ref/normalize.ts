/**
 * normalizeRef — the SourceRefService entry point (SPEC §9, launch gate §10.4).
 *
 * Pure and DB-free: takes a raw Hebrew-or-English ref and returns either the
 * canonical strings + structured parts, or a typed rejection. It NEVER throws
 * on expected-bad input (that is what the discriminated result is for); a throw
 * would only ever come from a corrupt WORKS table, caught at module load.
 *
 * Canonical strings are DERIVED from the structured parts, never by munging the
 * input, so "Shabbos 21a", "שבת כ״א ע״א" and "שבת דף כא." all collapse to one
 * value and dedup on the tuple.
 */
import { parseChapterVerse } from "./chapter-verse";
import { parseDafAmud } from "./daf-amud";
import { formatGematria } from "./gematria";
import type { NormalizeResult, RefError, RefStructured, WorkEntry } from "./types";
import { resolveWork } from "./works";

/** Bumped when the normalizer's output changes, so a Sefaria sync can find and
 *  re-normalize rows written by an older version (SPEC §9: refs are versioned). */
export const NORMALIZER_VERSION = 1;
export const WORKS_TABLE_VERSION = 1;

const HEBREW_AMUD = { a: "ע״א", b: "ע״ב" } as const;

function reject(error: RefError): NormalizeResult {
  return { ok: false, error };
}

function canonicalizeDafAmud(entry: WorkEntry, daf: number, amud: "a" | "b"): NormalizeResult {
  const structured: RefStructured = {
    work: entry.canonical,
    category: entry.category,
    locator: "DAF_AMUD",
    daf,
    amud,
    tableVersion: WORKS_TABLE_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
  };
  return {
    ok: true,
    value: {
      normalizedRef: `${entry.canonical} ${daf}${amud}`,
      hebrewRef: `${entry.hebrew} ${formatGematria(daf)} ${HEBREW_AMUD[amud]}`,
      structured,
    },
  };
}

function canonicalizeChapterVerse(
  entry: WorkEntry,
  chapter: number,
  verse: number | null,
): NormalizeResult {
  const structured: RefStructured = {
    work: entry.canonical,
    category: entry.category,
    locator: "CHAPTER_VERSE",
    chapter,
    verse,
    tableVersion: WORKS_TABLE_VERSION,
    normalizerVersion: NORMALIZER_VERSION,
  };
  // A whole-chapter ref (Psalms 23) omits the verse in both strings.
  const suffix = verse === null ? `${chapter}` : `${chapter}:${verse}`;
  const hebSuffix =
    verse === null ? formatGematria(chapter) : `${formatGematria(chapter)}:${formatGematria(verse)}`;
  return {
    ok: true,
    value: {
      normalizedRef: `${entry.canonical} ${suffix}`,
      hebrewRef: `${entry.hebrew} ${hebSuffix}`,
      structured,
    },
  };
}

export function normalizeRef(raw: string): NormalizeResult {
  const input = raw ?? "";
  const trimmed = input.trim();
  if (!trimmed) return reject({ code: "EMPTY", input, message: "no ref given" });

  // Commas separate like whitespace ("19 , amud a"); everything else is a token.
  const tokens = trimmed.replace(/,/g, " ").split(/\s+/).filter(Boolean);

  const work = resolveWork(tokens);
  if (!work.ok) {
    const message =
      work.code === "AMBIGUOUS_WORK"
        ? "that work name is shared by several tractates — be more specific"
        : "unknown work";
    return reject({ code: work.code, input, message });
  }

  if (work.entry.locator === "DAF_AMUD") {
    const parsed = parseDafAmud(work.entry, work.addressTokens, input);
    if ("code" in parsed) return reject(parsed);
    return canonicalizeDafAmud(work.entry, parsed.daf, parsed.amud);
  }

  if (work.entry.locator === "CHAPTER_VERSE") {
    const parsed = parseChapterVerse(work.entry, work.addressTokens, input);
    if ("code" in parsed) return reject(parsed);
    return canonicalizeChapterVerse(work.entry, parsed.chapter, parsed.verse);
  }

  // Mishnah/Rambam/SA locator kinds land in later slices.
  return reject({ code: "UNSUPPORTED", input, message: `${work.entry.locator} not yet supported` });
}
