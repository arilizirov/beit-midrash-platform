/**
 * normalizeRef for Talmud daf/amud (SPEC §9). Focused unit tests that pin each
 * parser rule and validation branch; the comprehensive §10.4 variant-spelling
 * acceptance set lands as its own data-driven gate in the next slice.
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

describe("amud notations all resolve to the same canonical", () => {
  const nineteenA: [string][] = [
    ["Zevachim 19a"],
    ["Zevachim 19A"],
    ["Zevachim 19 a"],
    ["Zevachim 19."],
    ["Zevachim 19a."], // trailing period is punctuation, not the amud dot
    ["זבחים י״ט ע״א"],
    ["זבחים יט."],
    ["זבחים דף יט עמוד א"],
    ["Zevachim daf 19 amud alef"],
    ["Zvachim 19 , amud A"],
  ];
  it.each(nineteenA)("%s → Zevachim 19a", (input) => {
    expect(ok(input).normalizedRef).toBe("Zevachim 19a");
  });

  it("reads amud b from every b-marker", () => {
    for (const raw of ["Zevachim 19b", "Zevachim 19:", "זבחים י״ט ע״ב", "זבחים יט:"]) {
      expect(ok(raw).normalizedRef).toBe("Zevachim 19b");
    }
  });
});

describe("canonical strings are derived from the structured tuple", () => {
  it("emits ref, hebrewRef, and versioned structured parts", () => {
    const v = ok("Shabbos 21a");
    expect(v.normalizedRef).toBe("Shabbat 21a");
    expect(v.hebrewRef).toBe("שבת כ״א ע״א");
    expect(v.structured).toMatchObject({
      work: "Shabbat",
      category: "TALMUD_BAVLI",
      locator: "DAF_AMUD",
      daf: 21,
      amud: "a",
      normalizerVersion: 1,
    });
  });

  it("formats the 15/16 gematria specials in hebrewRef", () => {
    expect(ok("Yoma 15b").hebrewRef).toBe("יומא ט״ו ע״ב");
    expect(ok("Pesachim 16a").hebrewRef).toBe("פסחים ט״ז ע״א");
  });
});

describe("the Hebrew daf/amud ambiguity", () => {
  it("does NOT read a bare Hebrew numeral's final letter as an amud", () => {
    // שבת כ״א = daf 21 with no amud marker; the final א is the numeral, not
    // amud a. Reading it as an amud would silently invent a locator.
    expect(code("שבת כ״א")).toBe("MISSING_AMUD");
  });

  it("still requires an amud on a Latin daf", () => {
    expect(code("Zevachim 19")).toBe("MISSING_AMUD");
  });
});

describe("daf range validation", () => {
  it("rejects daf below 2 — leaf 1 is the shaar, Gemara opens on 2a", () => {
    expect(code("Berakhot 1a")).toBe("DAF_OUT_OF_RANGE");
    expect(code("Shabbat 0b")).toBe("DAF_OUT_OF_RANGE");
  });

  it("rejects a daf past the tractate's end", () => {
    expect(code("Makkot 25a")).toBe("DAF_OUT_OF_RANGE"); // Makkot ends at 24
    expect(code("Zevachim 121a")).toBe("DAF_OUT_OF_RANGE"); // Zevachim ends at 120
  });

  it("rejects 64b of Berakhot, whose last daf has only amud a", () => {
    expect(code("Berakhot 64a")).toBe("OK");
    expect(code("Berakhot 64b")).toBe("DAF_OUT_OF_RANGE");
  });
});

describe("malformed and unsupported input", () => {
  it("rejects an amud that is not a or b", () => {
    expect(code("Zevachim 19c")).toBe("AMUD_INVALID");
  });

  it("rejects a chapter:verse locator handed to a Talmud work", () => {
    expect(code("Zevachim 19:5")).toBe("MALFORMED_LOCATOR");
  });

  it("rejects empty, injection, and cross-category garbage", () => {
    expect(code("")).toBe("EMPTY");
    expect(code("   ")).toBe("EMPTY");
    expect(code("Zevachim 19a'; DROP TABLE refs;--")).toBe("MALFORMED_LOCATOR");
    expect(code("Shabbat 12a Genesis 3:4")).toBe("MALFORMED_LOCATOR");
  });

  it("rejects an unknown or ambiguous work", () => {
    expect(code("Peah 5a")).toBe("UNKNOWN_WORK");
    expect(code("Bava 59a")).toBe("AMBIGUOUS_WORK");
  });
});
