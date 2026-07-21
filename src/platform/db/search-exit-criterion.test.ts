/**
 * SPEC §8 / launch gate §10.3 — THE HEBREW SEARCH EXIT CRITERION.
 *
 * "Load ≥50 real Hebrew items; test morphological queries (ו/ה/ב/כ/ל/מ/ש
 *  prefixes, plural/gender variants) against an expected-hits list. <80% pass
 *  ⇒ Meilisearch enters V1 behind the SearchService seam. Measured, not
 *  assumed."
 *
 * This file exists so that gate is a VISIBLE, failing-by-default thing rather
 * than a sentence in a document nobody re-reads before launch. It is skipped
 * until there is a real corpus — the criterion is explicitly about REAL items,
 * and measuring against invented ones would be the exact self-deception the
 * spec is guarding against.
 *
 * KNOWN WEAKNESS, stated up front: `bm_normalize` does nothing about the
 * prefix-letter problem, which is the largest item on that list. Trigram
 * bridges it one way only — a query for שבת reaches בשבת, but a query for
 * בשבת does not reach שבת. Expect this to be where the 80% is won or lost.
 *
 * TO RUN: seed ≥50 real topics from the group's own material, fill in the
 * expected hits, remove `.skip`, and record the score in docs/STACK.md.
 */
import { describe, expect, it } from "vitest";

/** The morphological cases §8 names. Queries are what a member would type. */
export const EXIT_CRITERION_QUERIES: { query: string; note: string }[] = [
  { query: "שבת", note: "bare noun; must also reach בשבת / השבת / ושבת" },
  { query: "בשבת", note: "ב prefix; reverse direction — the hard one" },
  { query: "הלכה", note: "singular; must reach הלכות" },
  { query: "הלכות", note: "plural; must reach הלכה" },
  { query: "זבחים", note: "tractate name as written in a source ref" },
  { query: "מחשבה", note: "appears mid-title, not as a prefix" },
  { query: "כשר", note: "root shared with כשרות — gender/number spread" },
  { query: "לימוד", note: "ל prefix on a common noun" },
  { query: "מועד", note: "seder name, also a common word" },
  { query: "שלום", note: "final-mem folding: must reach שלומים" },
];

describe.skip("SPEC §8 exit criterion (needs ≥50 real Hebrew items)", () => {
  it("scores ≥80% on the morphological query set, or Meilisearch enters V1", () => {
    // Deliberately not implemented against fabricated data: the criterion is
    // about REAL material, and a green score on invented text would be worse
    // than no score at all.
    expect(EXIT_CRITERION_QUERIES.length).toBeGreaterThanOrEqual(10);
  });
});
