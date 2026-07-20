/**
 * Layer-2 guards (SPEC §6) — the owed integration tests. The security
 * property under proof: suspending or soft-deleting a user REVOKES their
 * live session on the next request (Session rows survive soft-delete).
 * Only auth() is mocked (next-auth can't load under vitest); the gate rule,
 * DB, RLS and guard logic are real — and the singleton connects as the
 * NON-superuser app role, so the RLS claim here is not vacuous. redirect() throws NEXT_REDIRECT.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { appUrl } from "../../../test/db-url";

vi.mock("../../platform/auth", () => ({
  auth: vi.fn(),
}));

// guards use the app singleton — point it at the test DB before first use
process.env.DATABASE_URL = appUrl();

import { auth } from "../../platform/auth";
import { getPrisma, resetPrismaSingletons } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { seedGroupSlug } from "../../shared_kernel";

import { currentGroup, requireMembership, requireUser } from "./guards";

const mockAuth = vi.mocked(auth);
let groupId: string, memberId: string, outsiderId: string;

beforeAll(async () => {
  const db = getPrisma();
  // The guards resolve THE group by seeded slug — other suites' groups must
  // not be able to shadow it (that ambiguity is the bug this pins).
  groupId = (await db.group.create({ data: { slug: seedGroupSlug(), name: "קבוצה" } })).id;
  memberId = (await db.user.create({ data: { email: "member@gd.local" } })).id;
  outsiderId = (await db.user.create({ data: { email: "outsider@gd.local" } })).id;
  await withGroup(db, groupId, (tx) =>
    tx.membership.create({
      data: { userId: memberId, groupId, role: "MEMBER", status: "ACTIVE" },
    }),
  );
});

afterAll(async () => {
  await getPrisma().$disconnect();
  resetPrismaSingletons(); // never hand the next file a dead client
});

describe("requireUser (session continuation)", () => {
  it("no session ⇒ redirect to /signin", async () => {
    mockAuth.mockResolvedValueOnce(null as never);
    await expect(requireUser()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("active user passes", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: memberId } } as never);
    const user = await requireUser();
    expect(user.email).toBe("member@gd.local");
  });

  it("SUSPENDING a user kills their live session at the next request", async () => {
    await getPrisma().user.update({ where: { id: memberId }, data: { status: "SUSPENDED" } });
    try {
      mockAuth.mockResolvedValueOnce({ user: { id: memberId } } as never);
      await expect(requireUser()).rejects.toThrow(/NEXT_REDIRECT/);
    } finally {
      await getPrisma().user.update({ where: { id: memberId }, data: { status: "ACTIVE" } });
    }
  });

  it("soft-DELETING a user kills their live session at the next request", async () => {
    await getPrisma().user.update({ where: { id: memberId }, data: { deletedAt: new Date() } });
    try {
      mockAuth.mockResolvedValueOnce({ user: { id: memberId } } as never);
      await expect(requireUser()).rejects.toThrow(/NEXT_REDIRECT/);
    } finally {
      await getPrisma().user.update({ where: { id: memberId }, data: { deletedAt: null } });
    }
  });
});

describe("requireMembership (layer-2 core)", () => {
  it("an authenticated NON-member is redirected (indistinguishable from signed-out)", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: outsiderId } } as never);
    await expect(requireMembership()).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("a member without the capability is redirected home", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: memberId } } as never);
    await expect(requireMembership("invitation.create")).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("a member with no capability requirement passes with role attached", async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: memberId } } as never);
    const ctx = await requireMembership();
    expect(ctx.membership.role).toBe("MEMBER");
    expect(ctx.group.id).toBe(groupId);
  });
});

describe("currentGroup", () => {
  it("resolves THE seeded group deterministically, even with other groups present", async () => {
    // A decoy created after ours: an unordered findFirst could return either.
    await getPrisma().group.create({ data: { slug: "decoy-group", name: "אחרת" } });
    const g = await currentGroup();
    expect(g.id).toBe(groupId);
    expect(g.slug).toBe(seedGroupSlug());
  });
});
