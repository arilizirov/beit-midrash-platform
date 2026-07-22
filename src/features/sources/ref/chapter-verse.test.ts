/**
 * normalizeRef for Tanach chapter:verse (SPEC §9). Focused unit tests pinning
 * each rule; the comprehensive §10.4 acceptance set is the data-driven gate.
 */
import { describe, expect, it } from "vitest";

import { normalizeRef } from "./normalize";

function ok(raw: string) {
  const r = normalizeRef(raw);
  if (!r.ok) throw new Error(`expected ok for ${raw}, got ${r.error.code}`);
  return r.value;
}
function code(raw: string): string {
  const r = normalizeRef(raw);
  return r.ok ? "OK" : r.error.code;
}

describe("Tanach: transliteration + Hebrew fold to the English canonical", () => {
  const cases: [string, string, string][] = [
    ["Bereishit 1:1", "Genesis 1:1", "בראשית א׳:א׳"],
    ["בראשית א׳:א׳", "Genesis 1:1", "בראשית א׳:א׳"],
    ["Shemos 20:2", "Exodus 20:2", "שמות כ׳:ב׳"],
    ["Devarim 6:4", "Deuteronomy 6:4", "דברים ו׳:ד׳"],
    ["Tehillim 23:1", "Psalms 23:1", "תהלים כ״ג:א׳"],
    ["תהלים קי״ט:ק״ה", "Psalms 119:105", "תהלים קי״ט:ק״ה"],
    ["Kohelet 1:2", "Ecclesiastes 1:2", "קהלת א׳:ב׳"],
  ];
  it.each(cases)("%s → %s", (input, ref, heb) => {
    const v = ok(input);
    expect(v.normalizedRef).toBe(ref);
    expect(v.hebrewRef).toBe(heb);
  });

  it("accepts a space-separated abbreviated form", () => {
    expect(ok("בר׳ א א").normalizedRef).toBe("Genesis 1:1");
  });

  it("carries a versioned CHAPTER_VERSE tuple", () => {
    expect(ok("Genesis 1:1").structured).toMatchObject({
      work: "Genesis",
      category: "TANACH",
      locator: "CHAPTER_VERSE",
      chapter: 1,
      verse: 1,
      normalizerVersion: 1,
    });
  });
});

describe("split books and whole-chapter refs", () => {
  it("resolves a split book from its designation and folds the Hebrew", () => {
    const v = ok("Shmuel Alef 1:1");
    expect(v.normalizedRef).toBe("I Samuel 1:1");
    expect(v.hebrewRef).toBe("שמואל א א׳:א׳");
  });

  it("rejects a bare 'Shmuel' — it cannot choose between I and II Samuel", () => {
    expect(code("Shmuel 3:1")).toBe("AMBIGUOUS_WORK");
  });

  it("accepts a whole-chapter ref with no verse", () => {
    const v = ok("Psalms 23");
    expect(v.normalizedRef).toBe("Psalms 23");
    expect(v.hebrewRef).toBe("תהלים כ״ג");
    expect(v.structured).toMatchObject({ chapter: 23, verse: null });
  });
});

describe("chapter/verse validation and cross-grammar rejection", () => {
  it("rejects a chapter past the book's end", () => {
    expect(code("Bereishit 51:1")).toBe("CHAPTER_OUT_OF_RANGE"); // Genesis ends at 50
    expect(code("Tehillim 151:1")).toBe("CHAPTER_OUT_OF_RANGE"); // Psalms has 150
  });

  it("rejects verse 0 — a pasuk is 1-based", () => {
    expect(code("Genesis 1:0")).toBe("VERSE_OUT_OF_RANGE");
  });

  it("rejects a daf/amud locator handed to a Tanach book", () => {
    // Tanach has no dapim; "5a" / "119b" must not parse as a chapter.
    expect(code("Genesis 5a")).toBe("MALFORMED_LOCATOR");
    expect(code("Psalms 119b")).toBe("MALFORMED_LOCATOR");
  });

  it("rejects a non-canonical book", () => {
    expect(code("Maccabees 1:1")).toBe("UNKNOWN_WORK");
  });

  it("rejects more address parts than chapter:verse", () => {
    // Without the parts>2 guard this silently drops the extra and accepts a
    // wrong chapter:verse. A verse range (deferred in V1) also lands here.
    expect(code("Genesis 1:2:3")).toBe("MALFORMED_LOCATOR");
  });
});
