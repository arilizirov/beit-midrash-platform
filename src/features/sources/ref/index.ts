// Public surface of the pure ref-normalizer core (SPEC §9). Grows per slice;
// slice 1a exposes only the gematria codec that every locator kind reuses.
export { parseGematria, formatGematria } from "./gematria";
