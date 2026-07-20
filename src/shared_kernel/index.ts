/**
 * shared_kernel — public surface (boundaries.yaml: `public: [index]`).
 *
 * Tiny, boring, stable; imports nothing. If this file grows fast, that is a
 * smell — most code belongs in a feature module, not here.
 */
export { makeSlug } from "./slug";
export { canSignIn, type GateUser } from "./user-gate";
export { seedGroupSlug, DEFAULT_GROUP_SLUG } from "./group-slug";
export { newId, idPrefix } from "./ids";
