/**
 * shared_kernel/slug — URL slugs for Hebrew-first content (SPEC §5).
 *
 * A slug is `<idPrefix>-<title-words>`: the stable short id prefix (from the
 * entity's cuid) guarantees uniqueness, so the title part is purely cosmetic
 * and safe to regenerate. Hebrew letters are kept as-is — modern browsers and
 * Next.js route matching handle percent-encoded UTF-8 transparently.
 */

const MAX_SLUG_LENGTH = 80;

/** Strip Hebrew nikud + cantillation so visually-identical titles slug identically. */
function stripNikud(text: string): string {
  // U+0591–U+05C7 covers te'amim and nikud; the letters themselves are U+05D0+.
  return text.replace(/[֑-ׇ]/g, "");
}

export function makeSlug(title: string, idPrefix: string): string {
  const words = stripNikud(title)
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
