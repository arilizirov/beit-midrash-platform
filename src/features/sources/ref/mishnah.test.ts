/**
 * normalizeRef for Mishnah perek:mishnah (SPEC §9). Focused unit tests; the
 * comprehensive §10.4 acceptance set is the data-driven gate.
 *
 * The property specific to Mishnah: the "Mishnah" prefix is REQUIRED, so a bare
 * tractate name is never silently reclassified — "Berakhot 2a" stays Talmud,
 * "Mishnah Berakhot 1:1" is the Mishnah.
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

describe("Mishnah normalizes prefix + spelling variants to one canonical", () => {
  const cases: [string, string, string][] = [
    ["Mishnah Berakhot 1:1", "Mishnah Berakhot 1:1", "משנה ברכות א׳:א׳"],
    ["Mishna Peah 2:3", "Mishnah Peah 2:3", "משנה פאה ב׳:ג׳"],
    ["משנה ברכות א׳:א׳", "Mishnah Berakhot 1:1", "משנה ברכות א׳:א׳"],
    ["Pirkei Avot 1:1", "Mishnah Avot 1:1", "משנה אבות א׳:א׳"],
  ];
  it.each(cases)("%s → %s", (input, ref, heb) => {
    const v = ok(input);
    expect(v.normalizedRef).toBe(ref);
    expect(v.hebrewRef).toBe(heb);
  });

  it("carries a versioned CHAPTER_MISHNAH tuple", () => {
    expect(ok("Mishnah Berakhot 1:1").structured).toMatchObject({
      work: "Mishnah Berakhot",
      category: "MISHNAH",
      locator: "CHAPTER_MISHNAH",
      perek: 1,
      mishnah: 1,
    });
  });
});

describe("the Mishnah prefix is required — no silent reclassification", () => {
  it("a bare tractate name stays Talmud", () => {
    const v = ok("Berakhot 2a");
    expect(v.structured.category).toBe("TALMUD_BAVLI");
  });

  it("a bare tractate with a perek:mishnah address is not reclassified as Mishnah", () => {
    // "Berakhot 1:1" without the prefix is not a Talmud daf (colon = amud b,
    // leftover 1) and must NOT become Mishnah — the prefix is the only signal.
    const r = normalizeRef("Berakhot 1:1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("MALFORMED_LOCATOR");
  });
});

describe("Mishnah validation", () => {
  it("rejects a perek past the tractate's count", () => {
    // Mishnah Berakhot has 9 perakim.
    expect(code("Mishnah Berakhot 10:1")).toBe("CHAPTER_OUT_OF_RANGE");
  });

  it("rejects a perek-name address it cannot resolve to a number", () => {
    // "Bameh" is a chapter incipit; V1 addresses by number, so this is malformed
    // rather than silently guessed.
    expect(code("Mishnah Shabbat Bameh 2")).toBe("MALFORMED_LOCATOR");
  });

  it("accepts a whole-perek ref with no mishnah number", () => {
    const v = ok("Mishnah Avot 5");
    expect(v.normalizedRef).toBe("Mishnah Avot 5");
    expect(v.structured).toMatchObject({ perek: 5, mishnah: null });
  });
});
