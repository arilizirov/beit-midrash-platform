/**
 * Tanach chapter:verse parsing (SPEC §9). Consumes the raw address tokens
 * resolveWork left behind and produces { chapter, verse } (verse null for a
 * whole-chapter ref) or a typed rejection.
 *
 * V1 validates the chapter against the book's chapter count and requires
 * verse ≥ 1; exact per-chapter verse counts are deferred to the Sefaria
 * enrichment (so an out-of-range verse within a real chapter is accepted for
 * now — the conservative direction, never a wrong rejection).
 */
import { parseGematria } from "./gematria";
import type { ChapterVerseRange, RefError, RefErrorCode, WorkEntry } from "./types";

function fail(code: RefErrorCode, input: string, message: string): RefError {
  return { code, input, message };
}

/** A chapter or verse number: Arabic digits or a Hebrew gematria numeral. */
function parseNum(token: string): number | null {
  const t = token.trim();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  return parseGematria(t);
}

export function parseChapterVerse(
  entry: WorkEntry,
  addressTokens: readonly string[],
  input: string,
): { chapter: number; verse: number | null } | RefError {
  const range = entry.range as ChapterVerseRange;
  // Chapter and verse are separated by ':', '.', ',', or whitespace; a gematria
  // pair like "א׳ א׳" separates on the space. Split on all of them.
  const parts = addressTokens.join(" ").split(/[:.,]|\s+/).filter(Boolean);
  if (parts.length === 0) return fail("MALFORMED_LOCATOR", input, "no chapter given");
  if (parts.length > 2) {
    // More than chapter+verse — a range (1:1-5) or trailing junk. Ranges are a
    // deferred feature; anything else is malformed.
    return fail("MALFORMED_LOCATOR", input, "expected chapter:verse");
  }

  const chapter = parseNum(parts[0]);
  if (chapter === null) return fail("MALFORMED_LOCATOR", input, `could not read a chapter from "${parts[0]}"`);
  const verse = parts.length === 2 ? parseNum(parts[1]) : null;
  if (parts.length === 2 && verse === null) {
    return fail("MALFORMED_LOCATOR", input, `could not read a verse from "${parts[1]}"`);
  }

  if (chapter < 1 || chapter > range.chapters) {
    return fail("CHAPTER_OUT_OF_RANGE", input, `${entry.canonical} has chapters 1..${range.chapters}`);
  }
  if (verse !== null && verse < 1) {
    return fail("VERSE_OUT_OF_RANGE", input, "a verse is 1-based (there is no verse 0)");
  }
  return { chapter, verse };
}
