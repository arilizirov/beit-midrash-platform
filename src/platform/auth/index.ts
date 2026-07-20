/**
 * platform/auth — public surface.
 * `auth` reads the session server-side; `handlers` mount at /api/auth;
 * `signIn`/`signOut` are the server actions. canSignIn doubles as the
 * per-request continuation rule for F2c's requireUser (soft-delete →
 * session revocation).
 */
export { auth, handlers, signIn, signOut } from "./config";
export { canSignIn, type GateUser } from "./policy";
