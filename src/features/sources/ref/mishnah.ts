/**
 * Mishnah perek:mishnah (SPEC §9) — the same two-number shape as Tanach, over
 * the shared parser. V1 validates the perek against the tractate's perek count
 * and requires mishnah ≥ 1; per-perek mishnah counts are deferred (conservative
 * over-accept, never a wrong rejection). A whole-perek ref omits the mishnah.
 */
import { parseNumberedPair } from "./numbered-locator";
import type { ChapterMishnahRange, RefError, WorkEntry } from "./types";

export function parseChapterMishnah(
  entry: WorkEntry,
  addressTokens: readonly string[],
  input: string,
): { perek: number; mishnah: number | null } | RefError {
  const range = entry.range as ChapterMishnahRange;
  const pair = parseNumberedPair(addressTokens, input, {
    max: range.perakim,
    firstLabel: "perek",
    secondLabel: "mishnah",
    firstOob: "CHAPTER_OUT_OF_RANGE",
    secondOob: "VERSE_OUT_OF_RANGE",
    workName: entry.canonical,
  });
  if ("code" in pair) return pair;
  return { perek: pair.first, mishnah: pair.second };
}
