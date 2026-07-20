// Domain entities and pure business rules for taxonomy.
import type { TopicStatus } from "../../../generated/prisma/enums";

export type { TopicStatus };

/** SPEC §4: the category tree is bounded. Depth 1 = a root category. */
export const MAX_CATEGORY_DEPTH = 3;

/**
 * Pure depth rule, applied to a parent chain walked from the DB (nearest
 * parent first). Throws rather than returning a boolean so no caller can
 * forget to check — a documented invariant with no enforcement is worse
 * than none at all.
 */
export function assertDepthAllowed(ancestors: readonly { id: string }[]): void {
  const newDepth = ancestors.length + 1;
  if (newDepth > MAX_CATEGORY_DEPTH) {
    throw new Error(
      `category nesting exceeds MAX_CATEGORY_DEPTH (${MAX_CATEGORY_DEPTH}): would be depth ${newDepth}`,
    );
  }
}
