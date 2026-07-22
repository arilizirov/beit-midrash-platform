/**
 * A two-number locator — first:second where the second is optional (a whole
 * chapter, a whole perek). Tanach chapter:verse and Mishnah perek:mishnah are
 * the same shape, so both parse through here; only the labels, the max the
 * first number is checked against, and the out-of-range codes differ.
 *
 * Numbers are Arabic digits or Hebrew gematria; separators are ':', '.', ',',
 * or whitespace (a gematria pair like "א׳ א׳" separates on the space). More
 * than two parts — a range (1:1-5) or trailing junk — is malformed; ranges are
 * a deferred feature.
 */
import { formatGematria, parseGematria } from "./gematria";
import type { RefError, RefErrorCode } from "./types";

function fail(code: RefErrorCode, input: string, message: string): RefError {
  return { code, input, message };
}

function parseNum(token: string): number | null {
  const t = token.trim();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return Number.parseInt(t, 10);
  return parseGematria(t);
}

export type NumberedPair = { first: number; second: number | null };

export function parseNumberedPair(
  addressTokens: readonly string[],
  input: string,
  opts: {
    max: number;
    firstLabel: string;
    secondLabel: string;
    firstOob: RefErrorCode;
    secondOob: RefErrorCode;
    workName: string;
  },
): NumberedPair | RefError {
  const parts = addressTokens.join(" ").split(/[:.,]|\s+/).filter(Boolean);
  if (parts.length === 0) return fail("MALFORMED_LOCATOR", input, `no ${opts.firstLabel} given`);
  if (parts.length > 2) {
    return fail("MALFORMED_LOCATOR", input, `expected ${opts.firstLabel}:${opts.secondLabel}`);
  }

  const first = parseNum(parts[0]);
  if (first === null) {
    return fail("MALFORMED_LOCATOR", input, `could not read a ${opts.firstLabel} from "${parts[0]}"`);
  }
  const second = parts.length === 2 ? parseNum(parts[1]) : null;
  if (parts.length === 2 && second === null) {
    return fail("MALFORMED_LOCATOR", input, `could not read a ${opts.secondLabel} from "${parts[1]}"`);
  }

  if (first < 1 || first > opts.max) {
    return fail(opts.firstOob, input, `${opts.workName} has ${opts.firstLabel} 1..${opts.max}`);
  }
  if (second !== null && second < 1) {
    return fail(opts.secondOob, input, `a ${opts.secondLabel} is 1-based (there is no ${opts.secondLabel} 0)`);
  }
  return { first, second };
}

/**
 * Render the number pair for both the canonical ref and its Hebrew form —
 * shared so the two grammars that use it (Tanach chapter:verse, Mishnah
 * perek:mishnah) cannot drift on the separator or the whole-first-part case.
 */
export function formatNumberedPair(
  first: number,
  second: number | null,
): { suffix: string; hebSuffix: string } {
  return {
    suffix: second === null ? `${first}` : `${first}:${second}`,
    hebSuffix:
      second === null ? formatGematria(first) : `${formatGematria(first)}:${formatGematria(second)}`,
  };
}
