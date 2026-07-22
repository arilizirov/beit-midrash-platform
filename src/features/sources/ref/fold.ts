/**
 * foldWorkName — collapse a work-name token to a match key.
 *
 * Folds ONLY the work name, never an address: bm_normalize-style folding is
 * destructive to Hebrew addresses (it strips the gershayim that make yod-tet a
 * number and folds final letters that ARE numerals 500-900), so the pipeline
 * splits work from address BEFORE folding and leaves the address untouched.
 *
 * Fold, not translate: "Shabbos"/"shabbos"/" Shabbos " collapse, but
 * "Shabbos" and "Shabbat" do NOT — transliteration variants are enumerated in
 * each work's alias list, not guessed here. Alias and input pass through the
 * SAME fold, so matching is consistent by construction.
 *
 * Invisible/combining ranges are built from NUMERIC code points, so no
 * unreadable literal ever appears in this source.
 */

function charClass(ranges: ReadonlyArray<readonly [number, number]>): RegExp {
  const body = ranges
    .map(([lo, hi]) => {
      const a = `\\u${lo.toString(16).padStart(4, "0")}`;
      return lo === hi ? a : `${a}-\\u${hi.toString(16).padStart(4, "0")}`;
    })
    .join("");
  return new RegExp(`[${body}]`, "g");
}

// Nikud and te'amim — the EXPLICIT codepoints proven in the bm_normalize
// migration, deliberately NOT the 0591-05C7 range (which includes the maqaf,
// paseq, sof-pasuq and nun-hafukha SEPARATORS and would weld words together).
const NIKUD_AND_TEAMIM = charClass([
  [0x0591, 0x05bd],
  [0x05bf, 0x05bf],
  [0x05c1, 0x05c2],
  [0x05c4, 0x05c5],
  [0x05c7, 0x05c7],
]);

// Geresh (05F3) and gershayim (05F4); the ASCII ' " users type are handled
// alongside as ordinary characters.
const NUMERAL_MARKS = charClass([[0x05f3, 0x05f4]]);
const ASCII_NUMERAL_MARKS = /['"]/g;

// Bidi controls, zero-width characters, and the BOM that copy-paste drags along.
const INVISIBLES = charClass([
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2060],
  [0xfeff, 0xfeff],
]);

// Sofit (final) letters → their base form, so a name ending in one matches its
// non-final spelling elsewhere: final kaf/mem/nun/pe/tsadi.
const SOFIT: ReadonlyMap<string, string> = new Map([
  ["ך", "כ"],
  ["ם", "מ"],
  ["ן", "נ"],
  ["ף", "פ"],
  ["ץ", "צ"],
]);
const HEBREW_LETTER = /[א-ת]/g;

export function foldWorkName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(INVISIBLES, "")
    .replace(NIKUD_AND_TEAMIM, "")
    .replace(NUMERAL_MARKS, "")
    .replace(ASCII_NUMERAL_MARKS, "")
    .replace(HEBREW_LETTER, (ch) => SOFIT.get(ch) ?? ch)
    .toLowerCase()
    // JS \s already matches NBSP and the other Unicode spaces (and NFKD has
    // decomposed most to U+0020), so this collapse also handles no-break spaces.
    .replace(/\s+/g, " ")
    .trim();
}
