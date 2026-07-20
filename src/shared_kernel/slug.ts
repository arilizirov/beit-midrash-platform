/**
 * shared_kernel/slug — URL slugs for Hebrew-first content (SPEC §5).
 *
 * A slug is `<idPrefix>-<title-words>`: the stable short id prefix (from the
 * entity's cuid) makes collisions rare — NOT impossible, and there is no
 * retry today (ADR 0003) — so the title part is purely cosmetic
 * and safe to regenerate. Hebrew letters are kept as-is — modern browsers and
 * Next.js route matching handle percent-encoded UTF-8 transparently.
 */

// Cosmetic cap in UTF-16 code units (~160 UTF-8 bytes for all-Hebrew titles).
// Uniqueness never depends on it — the id prefix does that; this only keeps
// URLs readable. Revisit against real constraints when the first caller
// (taxonomy slice) lands.
const MAX_SLUG_LENGTH = 80;

/**
 * Strip marks that decorate letters without being letters:
 * - \p{Mn} = all combining marks — nikud, dagesh, meteg, and te'amim
 * - geresh/gershayim (׳ ״, U+05F3/U+05F4) — word-internal in Hebrew numerals
 *   like י״ט, which must stay one word, not split
 * Punctuation that *separates* words (maqaf ־, paseq, sof-pasuq) is deliberately
 * NOT stripped here — the separator split below handles it.
 */
function stripMarks(text: string): string {
  return text.replace(/[\p{Mn}׳״]/gu, "");
}

export function makeSlug(title: string, idPrefix: string): string {
  const words = stripMarks(title)
    .toLowerCase()
    // Keep Hebrew letters, Latin letters, and digits; everything else separates.
    .split(/[^א-תa-z0-9]+/u)
    .filter(Boolean);

  let slug = idPrefix;
  for (const word of words) {
    if (slug.length + 1 + word.length > MAX_SLUG_LENGTH) break;
    slug += `-${word}`;
  }
  return slug;
}
