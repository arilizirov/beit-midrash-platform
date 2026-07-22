/**
 * The work table (SPEC §9: "Tractate/work name table"). Slice 1b seeds the
 * Talmud Bavli tractates; Tanach, Mishnah, Rambam and Shulchan Aruch extend it
 * in later slices. Each entry carries the canonical + Hebrew titles, the locator
 * SHAPE, the validation range, and every spelling that must resolve to it.
 *
 * Two indexes are built ONCE at module load, and a violated invariant THROWS
 * (a programmer error in the table, caught at startup, never at request time):
 *   - ALIAS_INDEX: folded alias → entry, with a hard collision check so no two
 *     works can ever claim the same folded key.
 *   - AMBIGUOUS_PREFIXES: bare leading words shared by ≥2 works (e.g. "bava",
 *     "בבא"), so "Bava 59a" is rejected as ambiguous rather than guessed.
 */
import { foldWorkName } from "./fold";
import type { WorkEntry, WorkResolution } from "./types";

function talmud(
  canonical: string,
  hebrew: string,
  maxDaf: number,
  aliases: readonly string[],
  lastDafAmud?: "a" | "b",
): WorkEntry {
  return {
    canonical,
    hebrew,
    category: "TALMUD_BAVLI",
    locator: "DAF_AMUD",
    range: { kind: "DAF_AMUD", maxDaf, ...(lastDafAmud ? { lastDafAmud } : {}) },
    // canonical + hebrew are always aliases of themselves; the rest are the
    // transliteration variants a chevruta member might type.
    aliases: [canonical, hebrew, ...aliases],
  };
}

// `lastDafAmud` is CONSERVATIVE — set only where the final amud is certain
// (Berakhot 64a). Absent means both amudim are allowed on the last daf, so the
// validator over-accepts a rare nonexistent final "b" rather than risk
// rejecting a valid ref; the authoritative table lands with the Sefaria slice.
// Tanach: canonical is the ENGLISH book name (Sefaria's alignment), Hebrew is
// the traditional title. `chapters` bounds the perek; split books carry the
// Roman-numeral designation in both the canonical ("I Samuel") and the Hebrew
// ("שמואל א"), and a bare "Shmuel"/"שמואל" is left ambiguous by the resolver.
function tanach(
  canonical: string,
  hebrew: string,
  chapters: number,
  aliases: readonly string[],
): WorkEntry {
  return {
    canonical,
    hebrew,
    category: "TANACH",
    locator: "CHAPTER_VERSE",
    range: { kind: "CHAPTER_VERSE", chapters },
    aliases: [canonical, hebrew, ...aliases],
  };
}

export const WORKS: readonly WorkEntry[] = [
  talmud("Berakhot", "ברכות", 64, ["Berachot", "Berachos", "Brachot", "Brachos", "Berakhoth", "Brochos"], "a"),
  talmud("Shabbat", "שבת", 157, ["Shabbos", "Shabbath", "Shabos", "Shabat"]),
  talmud("Eruvin", "עירובין", 105, ["Eiruvin", "Erubin"]),
  talmud("Pesachim", "פסחים", 121, ["Pesochim", "Psachim"]),
  talmud("Yoma", "יומא", 88, ["Yuma"]),
  talmud("Sukkah", "סוכה", 56, ["Succah", "Sukka", "Suka"]),
  talmud("Rosh Hashanah", "ראש השנה", 35, ["Rosh HaShana", "Rosh Hashana"]),
  talmud("Megillah", "מגילה", 32, ["Megila", "Megilla"]),
  talmud("Yevamot", "יבמות", 122, ["Yevamos", "Yevomos"]),
  talmud("Ketubot", "כתובות", 112, ["Kesubos", "Ketubos", "Kesuvos"]),
  talmud("Gittin", "גיטין", 90, ["Gitin"]),
  talmud("Kiddushin", "קידושין", 82, ["Kidushin", "Kiddushim"]),
  talmud("Bava Kamma", "בבא קמא", 119, ["Bava Kama", "Baba Kamma", "Baba Kama"]),
  talmud("Bava Metzia", "בבא מציעא", 119, ["Bava Metziah", "Baba Metzia", "Baba Metziah", "Bava Mezia"]),
  talmud("Bava Batra", "בבא בתרא", 176, ["Bava Basra", "Baba Batra", "Baba Basra"]),
  talmud("Sanhedrin", "סנהדרין", 113, ["Sanhedrim"]),
  talmud("Makkot", "מכות", 24, ["Makkos", "Makos"]),
  talmud("Avodah Zarah", "עבודה זרה", 76, ["Avoda Zara", "Avodah Zara", "Avoda Zarah"]),
  talmud("Zevachim", "זבחים", 120, ["Zvachim", "Zevahim", "Zebachim"]),
  talmud("Menachot", "מנחות", 110, ["Menachos", "Menochos"]),
  talmud("Chullin", "חולין", 142, ["Hullin", "Chulin", "Hulin"]),
  talmud("Niddah", "נדה", 73, ["Nidda", "Niddah", "Nida"]),

  // ---- Tanach (English canonical) --------------------------------------
  tanach("Genesis", "בראשית", 50, ["Bereishit", "Bereshit", "Bereishis", "Breishis", "בר׳"]),
  tanach("Exodus", "שמות", 40, ["Shemot", "Shemos", "Shmos", "Shmot"]),
  tanach("Leviticus", "ויקרא", 27, ["Vayikra", "Vayikro"]),
  tanach("Numbers", "במדבר", 36, ["Bamidbar", "Bemidbar"]),
  tanach("Deuteronomy", "דברים", 34, ["Devarim", "Devorim"]),
  tanach("Isaiah", "ישעיהו", 66, ["Yeshayahu", "Yeshaya", "Yeshayah"]),
  tanach("Jeremiah", "ירמיהו", 52, ["Yirmiyahu", "Yirmiya"]),
  tanach("Ezekiel", "יחזקאל", 48, ["Yechezkel"]),
  tanach("I Samuel", "שמואל א", 31, ["Shmuel Alef", "1 Samuel", "First Samuel"]),
  tanach("II Samuel", "שמואל ב", 24, ["Shmuel Bet", "2 Samuel", "Second Samuel"]),
  tanach("I Kings", "מלכים א", 22, ["Melachim Alef", "1 Kings"]),
  tanach("II Kings", "מלכים ב", 25, ["Melachim Bet", "2 Kings"]),
  tanach("Psalms", "תהלים", 150, ["Tehillim", "Tehilim"]),
  tanach("Proverbs", "משלי", 31, ["Mishlei"]),
  tanach("Job", "איוב", 42, ["Iyov"]),
  tanach("Song of Songs", "שיר השירים", 8, ["Shir HaShirim", "Shir Hashirim", "Canticles"]),
  tanach("Ruth", "רות", 4, ["Rus"]),
  tanach("Lamentations", "איכה", 5, ["Eichah", "Eicha"]),
  tanach("Ecclesiastes", "קהלת", 12, ["Kohelet", "Koheles"]),
  tanach("Esther", "אסתר", 10, ["Ester"]),
  tanach("Daniel", "דניאל", 12, []),
  tanach("Ezra", "עזרא", 10, []),
  tanach("Nehemiah", "נחמיה", 13, ["Nechemiah"]),
];

type Indexes = { aliasIndex: Map<string, WorkEntry>; ambiguousPrefixes: Set<string> };

/**
 * Build the two lookup indexes, THROWING if two works claim the same folded
 * alias — a table bug that must fail loudly at load, not silently shadow one
 * work at request time. Exported so the guard can be tested against a
 * deliberately-colliding table, not only the real one.
 */
export function buildIndexes(works: readonly WorkEntry[]): Indexes {
  const aliasIndex = new Map<string, WorkEntry>();
  const firstWordWorks = new Map<string, Set<string>>();

  for (const entry of works) {
    for (const alias of entry.aliases) {
      const key = foldWorkName(alias);
      const clash = aliasIndex.get(key);
      if (clash && clash.canonical !== entry.canonical) {
        throw new Error(
          `work alias collision: "${key}" claimed by both ${clash.canonical} and ${entry.canonical}`,
        );
      }
      aliasIndex.set(key, entry);
      const first = key.split(" ")[0];
      (firstWordWorks.get(first) ?? firstWordWorks.set(first, new Set()).get(first)!).add(
        entry.canonical,
      );
    }
  }

  // A bare leading word that begins ≥2 different works, and is not itself a
  // complete work name, cannot select a tractate on its own.
  const ambiguousPrefixes = new Set<string>();
  for (const [word, ws] of firstWordWorks) {
    if (ws.size >= 2 && !aliasIndex.has(word)) ambiguousPrefixes.add(word);
  }
  return { aliasIndex, ambiguousPrefixes };
}

const { aliasIndex: ALIAS_INDEX, ambiguousPrefixes: AMBIGUOUS_PREFIXES } = buildIndexes(WORKS);

// Work names run 1..3 tokens (e.g. "Rosh Hashanah", "Shir HaShirim" later).
const MAX_WORK_TOKENS = 3;

/**
 * Resolve the leading work token(s) of an already-tokenized ref, returning the
 * matched work and the address tokens left over — or a typed rejection. Tries
 * the LONGEST leading run first so "Bava Metzia" wins over a bare "Bava".
 */
export function resolveWork(tokens: readonly string[]): WorkResolution {
  const maxLen = Math.min(MAX_WORK_TOKENS, tokens.length);
  // Longest run first. With the Talmud-only table no work name is a token-prefix
  // of another, so this is currently equivalent to shortest-first and untested
  // as a direction; it becomes load-bearing when Tanach adds a bare "Shmuel"
  // alongside "Shmuel Alef", at which point the longer match must win.
  for (let len = maxLen; len >= 1; len--) {
    const key = foldWorkName(tokens.slice(0, len).join(" "));
    const entry = ALIAS_INDEX.get(key);
    if (entry) return { ok: true, entry, addressTokens: tokens.slice(len) };
  }
  const first = foldWorkName(tokens[0] ?? "");
  if (AMBIGUOUS_PREFIXES.has(first)) return { ok: false, code: "AMBIGUOUS_WORK" };
  return { ok: false, code: "UNKNOWN_WORK" };
}

/** Exposed for tests that assert the table's shape (ranges, ambiguity set). */
export const _internals = { ALIAS_INDEX, AMBIGUOUS_PREFIXES };
