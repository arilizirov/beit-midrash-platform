import { describe, expect, it } from "vitest";

import { canSignIn, canUseSession } from "./policy";

const active = { status: "ACTIVE", deletedAt: null } as const;

describe("canSignIn (invite-only gate)", () => {
  it("allows an existing active user", () => {
    expect(canSignIn(active)).toBe(true);
  });

  it("denies an unknown email — no User row, no login (invite-only)", () => {
    expect(canSignIn(null)).toBe(false);
  });

  it("denies suspended and deactivated users", () => {
    expect(canSignIn({ status: "SUSPENDED", deletedAt: null })).toBe(false);
    expect(canSignIn({ status: "DEACTIVATED", deletedAt: null })).toBe(false);
  });

  it("denies a soft-deleted user even if status still reads ACTIVE", () => {
    expect(canSignIn({ status: "ACTIVE", deletedAt: new Date() })).toBe(false);
  });
});

describe("canUseSession (per-request revocation)", () => {
  it("is the same rule — soft-deleting a user kills their live sessions at next request", () => {
    expect(canUseSession(active)).toBe(true);
    expect(canUseSession({ status: "ACTIVE", deletedAt: new Date() })).toBe(false);
    expect(canUseSession(null)).toBe(false);
  });
});
