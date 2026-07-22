// Public surface of the sources domain. Export ONLY what other domains/app use.
export {
  addCitation,
  findOrCreateSource,
  listCitationsForEntity,
  listCitationsForSource,
  normalizeRef,
} from "./service";
export type { CitationEntityType, SourceResult } from "./types";
export type { NormalizeResult, NormalizedRef, RefError, RefStructured } from "./ref";
