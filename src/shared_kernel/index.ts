/**
 * shared_kernel — public surface (boundaries.yaml: `public: [index]`).
 *
 * Tiny, boring, stable; imports nothing. If this file grows fast, that is a
 * smell — most code belongs in a feature module, not here.
 */
export { makeSlug } from "./slug";
