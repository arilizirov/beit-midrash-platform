// Domain entities and pure business rules for taxonomy.
import type { TopicStatus } from "../../../generated/prisma/enums";

export type { TopicStatus };

/** SPEC §4: the category tree is bounded. Depth 1 = a root category. */
export const MAX_CATEGORY_DEPTH = 3;

/**
 * Pure depth rule, given the number of ancestors above the new node. Throws
 * rather than returning a boolean so no caller can forget to check — a
 * documented invariant with no enforcement is worse than none at all.
 */
export function assertDepthAllowed(ancestorCount: number): void {
  const newDepth = ancestorCount + 1;
  if (newDepth > MAX_CATEGORY_DEPTH) {
    throw new Error(
      `category nesting exceeds MAX_CATEGORY_DEPTH (${MAX_CATEGORY_DEPTH}): would be depth ${newDepth}`,
    );
  }
}
