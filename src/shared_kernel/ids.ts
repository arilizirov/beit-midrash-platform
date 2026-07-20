/**
 * Id generation (SPEC §4: cuid everywhere, never auto-increment).
 *
 * Generated in APP CODE, not by the database default, so a row's slug — which
 * embeds a prefix of its own id — can be computed BEFORE the insert. The
 * alternative (insert with a placeholder slug, then update) makes every
 * concurrent create in a group contend on the same placeholder key.
 */
import { createId } from "@paralleldrive/cuid2";

export function newId(): string {
  return createId();
}

/** Short, stable, collision-safe prefix for human-facing slugs. */
export function idPrefix(id: string): string {
  return id.slice(-6);
}
