/**
 * The gematria codec is pure and total over 1..999, so it can be pinned hard:
 * every value round-trips, and the two Divine-Name exceptions (15, 16) are
 * checked in both directions. A bug here would silently mis-address a source.
 */
import { describe, expect, it } from "vitest";

import { formatGematria, parseGematria } from "./gematria";

describe("parseGematria", () => {
  it("reads additive numerals high-to-low", () => {
    expect(parseGematria("יט")).toBe(19); // 10 + 9
    expect(parseGematria("קנז")).toBe(157); // 100 + 50 + 7
    expect(parseGematria("קיט")).toBe(119); // 100 + 10 + 9
    expect(parseGematria("תתקצט")).toBe(999); // 400+400+100+90+9
  });

  it("reads the 15 and 16 forms as their sum", () => {
    expect(parseGematria("טו")).toBe(15);
    expect(parseGematria("טז")).toBe(16);
    expect(parseGematria("קטו")).toBe(115);
  });

  it("strips geresh, gershayim, and their ASCII substitutes", () => {
    expect(parseGematria("י״ט")).toBe(19);
    expect(parseGematria('י"ט')).toBe(19); // straight double-quote for gershayim
    expect(parseGematria("ב׳")).toBe(2);
    expect(parseGematria("ב'")).toBe(2); // apostrophe for geresh
    expect(parseGematria("ק״ה")).toBe(105);
  });

  it("folds sofit (final) letters to their base value", () => {
    expect(parseGematria("ך")).toBe(20); // final kaf == kaf
    expect(parseGematria("ם")).toBe(40);
    expect(parseGematria("ן")).toBe(50);
    expect(parseGematria("ף")).toBe(80);
    expect(parseGematria("ץ")).toBe(90);
  });

  it("returns null for anything that is not a Hebrew numeral", () => {
    expect(parseGematria("")).toBeNull();
    expect(parseGematria("   ")).toBeNull();
    expect(parseGematria("19")).toBeNull(); // Latin digits are not gematria
    expect(parseGematria("abc")).toBeNull();
    expect(parseGematria("יטx")).toBeNull(); // one bad char poisons the whole
  });
});

describe("formatGematria", () => {
  it("marks a lone letter with geresh and a multi-letter numeral with gershayim", () => {
    expect(formatGematria(2)).toBe("ב׳");
    expect(formatGematria(400)).toBe("ת׳");
    expect(formatGematria(19)).toBe("י״ט");
    expect(formatGematria(105)).toBe("ק״ה");
    expect(formatGematria(157)).toBe("קנ״ז");
  });

  it("emits the Divine-Name-avoiding forms for 15 and 16, never יה/יו", () => {
    expect(formatGematria(15)).toBe("ט״ו");
    expect(formatGematria(16)).toBe("ט״ז");
    expect(formatGematria(115)).toBe("קט״ו"); // the exception rides along in hundreds
    expect(formatGematria(216)).toBe("רט״ז");
  });

  it("builds 500-900 by additive hundreds letters", () => {
    expect(formatGematria(500)).toBe("ת״ק");
    expect(formatGematria(786)).toBe("תשפ״ו");
    expect(formatGematria(900)).toBe("תת״ק"); // 400+400+100 → תתק
  });

  it("throws on values outside a locator's range", () => {
    expect(() => formatGematria(0)).toThrow(/range/);
    expect(() => formatGematria(1000)).toThrow(/range/);
    expect(() => formatGematria(-5)).toThrow(/range/);
    expect(() => formatGematria(2.5)).toThrow(/range/);
  });
});

describe("round-trip over the whole locator range", () => {
  it("parse(format(n)) === n for every 1..999", () => {
    // The strongest single check: any asymmetry between the two directions —
    // a mis-placed gershayim, a dropped hundreds letter, a 15/16 slip — shows
    // up as at least one n that fails to come back.
    const broken: number[] = [];
    for (let n = 1; n <= 999; n++) {
      if (parseGematria(formatGematria(n)) !== n) broken.push(n);
    }
    expect(broken).toEqual([]);
  });
});
