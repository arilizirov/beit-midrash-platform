// Public surface of the pure ref-normalizer core (SPEC §9). Grows per slice.
export { parseGematria, formatGematria } from "./gematria";
export { foldWorkName } from "./fold";
export { resolveWork, WORKS } from "./works";
export { normalizeRef, NORMALIZER_VERSION, WORKS_TABLE_VERSION } from "./normalize";
export type {
  WorkCategory, LocatorKind, WorkEntry, WorkRange, WorkResolution,
  RefError, RefErrorCode, RefStructured, NormalizedRef, NormalizeResult,
} from "./types";
