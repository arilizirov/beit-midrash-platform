/**
 * Tanach chapter:verse (SPEC §9) — a thin wrapper over the shared two-number
 * locator parser. V1 validates the chapter against the book's chapter count and
 * requires verse ≥ 1; exact per-chapter verse counts are deferred to the
 * Sefaria enrichment (an out-of-range verse in a real chapter is accepted for
 * now — the conservative direction, never a wrong rejection).
 */
import { parseNumberedPair } from "./numbered-locator";
import type { ChapterVerseRange, RefError, WorkEntry } from "./types";

export function parseChapterVerse(
  entry: WorkEntry,
  addressTokens: readonly string[],
  input: string,
): { chapter: number; verse: number | null } | RefError {
  const range = entry.range as ChapterVerseRange;
  const pair = parseNumberedPair(addressTokens, input, {
    max: range.chapters,
    firstLabel: "chapter",
    secondLabel: "verse",
    firstOob: "CHAPTER_OUT_OF_RANGE",
    secondOob: "VERSE_OUT_OF_RANGE",
    workName: entry.canonical,
  });
  if ("code" in pair) return pair;
  return { chapter: pair.first, verse: pair.second };
}
