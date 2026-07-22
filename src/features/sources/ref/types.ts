/**
 * Shared types for the pure ref normalizer (SPEC §9). String unions mirror the
 * eventual DB enums so the pure core stays free of the generated client; the
 * schema slice pins them against the real enums. SPEC §4: TALMUD_BAVLI verbatim.
 */
export type WorkCategory =
  | "TALMUD_BAVLI"
  | "TANACH"
  | "MISHNAH"
  | "RAMBAM"
  | "SHULCHAN_ARUCH"
  | "MIDRASH"
  | "OTHER";

/** The SHAPE of a work's address, decoupled from its category (a work maps 1:1
 *  to a category, but locator shapes differ). Grows per slice. */
export type LocatorKind =
  | "DAF_AMUD"
  | "CHAPTER_VERSE"
  | "CHAPTER_MISHNAH"
  | "NESTED"
  | "SIMAN_SEIF"
  | "FREEFORM";

/** Talmud: an integer daf (folio) starting at 2, with amud a/b. `lastDafAmud`
 *  records when a tractate's final daf has only amud a (e.g. Berakhot ends 64a);
 *  absent means both amudim exist on the last daf. */
export type DafAmudRange = { kind: "DAF_AMUD"; maxDaf: number; lastDafAmud?: "a" | "b" };

/** The union grows as locator kinds land (Tanach adds CHAPTER_VERSE next). */
export type WorkRange = DafAmudRange;

export type WorkEntry = {
  /** Title used in the canonical ref: transliteration for Talmud ("Shabbat"),
   *  the English name for Tanach ("Genesis") — both Sefaria's canonical. */
  canonical: string;
  /** Hebrew title used in hebrewRef, e.g. "שבת". */
  hebrew: string;
  category: WorkCategory;
  locator: LocatorKind;
  range: WorkRange;
  /** Every spelling that resolves here — folded once at load. */
  aliases: readonly string[];
};

/** Result of resolving the leading work token(s): the matched work plus the
 *  address tokens left for the locator parser, or a typed rejection. */
export type WorkResolution =
  | { ok: true; entry: WorkEntry; addressTokens: string[] }
  | { ok: false; code: "UNKNOWN_WORK" | "AMBIGUOUS_WORK" };

export type RefErrorCode =
  | "EMPTY"
  | "UNKNOWN_WORK"
  | "AMBIGUOUS_WORK"
  | "MALFORMED_LOCATOR"
  | "MISSING_AMUD"
  | "AMUD_INVALID"
  | "DAF_OUT_OF_RANGE"
  | "UNSUPPORTED";

/** A rejection, returned for expected-bad input — never a thrown exception. */
export type RefError = { code: RefErrorCode; input: string; message: string };

/** Typed address parts stored in Source.refStructured, plus the two version
 *  stamps that let a future Sefaria sync re-normalize legacy rows (SPEC §9). */
export type RefStructured = {
  work: string;
  category: WorkCategory;
  locator: "DAF_AMUD";
  daf: number;
  amud: "a" | "b";
  tableVersion: number;
  normalizerVersion: number;
};

export type NormalizedRef = {
  /** Space form, e.g. "Zevachim 19a" (the route form uses a dot). */
  normalizedRef: string;
  hebrewRef: string;
  structured: RefStructured;
};

export type NormalizeResult =
  | { ok: true; value: NormalizedRef }
  | { ok: false; error: RefError };
