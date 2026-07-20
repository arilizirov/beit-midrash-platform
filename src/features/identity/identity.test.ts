import { describe, expect, it } from "vitest";

import { can } from "./service";

describe("can() — RBAC capability check (SPEC §6 matrix, live rows only)", () => {
  it("OWNER and ADMIN may invite", () => {
    expect(can("OWNER", "invitation.create")).toBe(true);
    expect(can("ADMIN", "invitation.create")).toBe(true);
  });

  it("EDITOR, MEMBER, GUEST may not invite (SPEC §6: invite = owner/admin only)", () => {
    expect(can("EDITOR", "invitation.create")).toBe(false);
    expect(can("MEMBER", "invitation.create")).toBe(false);
    expect(can("GUEST", "invitation.create")).toBe(false);
  });

  it("revoking an invitation follows the same rule", () => {
    expect(can("ADMIN", "invitation.revoke")).toBe(true);
    expect(can("MEMBER", "invitation.revoke")).toBe(false);
  });
});
