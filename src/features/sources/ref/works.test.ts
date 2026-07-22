/**
 * The work-name resolver (SPEC §9: fold Zevachim/Zvachim/זבחים to one canonical).
 * This is half the normalizer's job — turning however a member spells a work
 * into a single table entry — and is tested in isolation from address parsing.
 */
import { describe, expect, it } from "vitest";

import { foldWorkName } from "./fold";
import { buildIndexes, resolveWork, WORKS, _internals } from "./works";
import type { WorkEntry } from "./types";

/** Convenience: resolve from a raw string the way the pipeline will tokenize. */
function resolve(raw: string) {
  return resolveWork(raw.trim().split(/\s+/));
}

describe("foldWorkName", () => {
  it("normalizes case and surrounding whitespace", () => {
    expect(foldWorkName("  Shabbos  ")).toBe("shabbos");
    expect(foldWorkName("BAVA   METZIA")).toBe("bava metzia");
  });

  it("folds sofit letters so a final form matches its base spelling", () => {
    // Both the alias and the input pass through this fold, so consistency —
    // not the specific output — is what matters. Final mem folds to mem.
    expect(foldWorkName("זבחים")).toBe(foldWorkName("זבחימ"));
  });

  it("strips nikud and gershayim without welding words", () => {
    expect(foldWorkName("בָּבָא")).toBe(foldWorkName("בבא"));
    expect(foldWorkName('שבת')).toBe("שבת");
  });

  it("strips invisibles (RLM, NBSP) that copy-paste drags along", () => {
    const RLM = String.fromCharCode(0x200f);
    const NBSP = String.fromCharCode(0x00a0);
    expect(foldWorkName("שבת" + RLM)).toBe(foldWorkName("שבת"));
    expect(foldWorkName("בבא" + NBSP + "מציעא")).toBe(foldWorkName("בבא מציעא"));
  });

  it("does NOT strip the maqaf separator (widening the range would weld words)", () => {
    // The bug the bm_normalize migration warns against: a naive 0591-05C7 range
    // swallows the maqaf and merges two words into one token.
    const maqaf = String.fromCharCode(0x05be);
    expect(foldWorkName("א" + maqaf + "ב")).toContain(maqaf);
  });
});

describe("resolveWork — transliteration variants fold to one canonical", () => {
  const families: [string, string][] = [
    ["Shabbos 21a", "Shabbat"],
    ["Zvachim 19b", "Zevachim"],
    ["Zevachim 19b", "Zevachim"],
    ["Berachos 2a", "Berakhot"],
    ["Brachos 2b", "Berakhot"],
    ["Kesubos 2a", "Ketubot"],
    ["Hullin 17b", "Chullin"],
    ["Avoda Zara 5a", "Avodah Zarah"],
    ["Kidushin 2a", "Kiddushin"],
    ["Succah 2a", "Sukkah"],
    ["Baba Metziah 59a", "Bava Metzia"],
    ["Bava Kama 2a", "Bava Kamma"],
  ];
  it.each(families)("%s → %s", (input, canonical) => {
    const r = resolve(input);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.canonical).toBe(canonical);
  });

  it("resolves Hebrew work names too, leaving the address tokens untouched", () => {
    const r = resolve("זבחים י״ט ע״א");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.canonical).toBe("Zevachim");
      expect(r.entry.hebrew).toBe("זבחים");
      // The address is handed back verbatim — NOT folded (its gershayim carry
      // the number). The address parser owns it next.
      expect(r.addressTokens).toEqual(["י״ט", "ע״א"]);
    }
  });

  it("matches the longest leading work run, so a two-word tractate wins", () => {
    const r = resolve("בבא מציעא נ״ט ע״א");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.entry.canonical).toBe("Bava Metzia");
      expect(r.addressTokens).toEqual(["נ״ט", "ע״א"]);
    }
  });
});

describe("resolveWork — rejections", () => {
  it("rejects a bare shared prefix as ambiguous, not a guess", () => {
    // 'Bava' begins three tractates; alone it names none of them.
    expect(resolve("Bava 59a")).toEqual({ ok: false, code: "AMBIGUOUS_WORK" });
    expect(resolve("בבא נ״ט ע״א")).toEqual({ ok: false, code: "AMBIGUOUS_WORK" });
  });

  it("rejects a work not in the table", () => {
    expect(resolve("Peah 5a")).toEqual({ ok: false, code: "UNKNOWN_WORK" });
    expect(resolve("Xyzzy 5a")).toEqual({ ok: false, code: "UNKNOWN_WORK" });
  });
});

describe("the table itself", () => {
  it("carries the validation range every tractate needs", () => {
    const shabbat = WORKS.find((w) => w.canonical === "Shabbat");
    expect(shabbat?.range).toEqual({ kind: "DAF_AMUD", maxDaf: 157 });
    const berakhot = WORKS.find((w) => w.canonical === "Berakhot");
    // Berakhot's last daf has only amud a — recorded so 64b can be rejected.
    expect(berakhot?.range).toEqual({ kind: "DAF_AMUD", maxDaf: 64, lastDafAmud: "a" });
  });

  it("knows 'bava' is an ambiguous prefix but not a resolvable work", () => {
    expect(_internals.AMBIGUOUS_PREFIXES.has("bava")).toBe(true);
    expect(_internals.AMBIGUOUS_PREFIXES.has("בבא")).toBe(true);
    expect(_internals.ALIAS_INDEX.has("bava")).toBe(false);
  });

  it("throws at build time if two works claim the same folded alias", () => {
    // Directly exercises the guard against a deliberately-colliding table —
    // the real WORKS building without a throw is the passive half of this.
    const dup = (canonical: string): WorkEntry => ({
      canonical, hebrew: "כפול", category: "TALMUD_BAVLI", locator: "DAF_AMUD",
      range: { kind: "DAF_AMUD", maxDaf: 10 }, aliases: [canonical, "שבת"],
    });
    expect(() => buildIndexes([dup("Alpha"), dup("Beta")])).toThrow(/collision/);
    // (The real WORKS builds without throwing at import — the passive half.)
  });
});
