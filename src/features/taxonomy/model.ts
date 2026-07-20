// Domain entities and pure business rules for taxonomy.
import type { TopicStatus } from "../../../generated/prisma/enums";

export type { TopicStatus };

/** SPEC §4: the category tree is bounded — depth is an app-level invariant. */
export const MAX_CATEGORY_DEPTH = 3;
