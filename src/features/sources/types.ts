// Public types for the sources service. CitationEntityType is the generated
// Prisma enum (kept in one place so callers don't reach into generated/).
import type { Source } from "../../../generated/prisma/client";
import type { CitationEntityType } from "../../../generated/prisma/enums";

import type { RefError } from "./ref";

export type { CitationEntityType };

/** find-or-create: a Source on success, or the normalizer's typed rejection so
 *  a server action can surface a field-level message instead of a 500. */
export type SourceResult = { ok: true; source: Source } | { ok: false; error: RefError };
