/**
 * ADR 0002: identity = the ACTIVE row. Partial uniques let history repeat —
 * a member can leave (soft-delete) and be re-invited; an invitation can be
 * re-sent after the previous one was accepted. Absolute uniques made both
 * impossible. Also: Invitation is groupId-scoped ⇒ same RLS wall as
 * Membership (enrollment itself is proven by the catalog-scan test).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";
import { withGroup } from "./index";

let db: PrismaClient;
let groupA: string, groupB: string, userId: string, adminId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  const [a, b] = await Promise.all([
    db.group.create({ data: { slug: "lc-group-a", name: "חבורה א" } }),
    db.group.create({ data: { slug: "lc-group-b", name: "חבורה ב" } }),
  ]);
  groupA = a.id;
  groupB = b.id;
  userId = (await db.user.create({ data: { email: "member@lc.local" } })).id;
  adminId = (await db.user.create({ data: { email: "gabbai@lc.local" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("membership lifecycle (leave → re-invite)", () => {
  it("a soft-deleted membership does not block rejoining", async () => {
    const first = await withGroup(db, groupA, (tx) =>
      tx.membership.create({
        data: { userId, groupId: groupA, role: "MEMBER", status: "ACTIVE" },
      }),
    );
    await withGroup(db, groupA, (tx) =>
      tx.membership.update({ where: { id: first.id }, data: { deletedAt: new Date() } }),
    );
    // Under SPEC §4's absolute unique this create threw P2002. ADR 0002 allows it.
    const rejoined = await withGroup(db, groupA, (tx) =>
      tx.membership.create({
        data: { userId, groupId: groupA, role: "MEMBER", status: "ACTIVE" },
      }),
    );
    expect(rejoined.id).not.toBe(first.id);
  });

  it("two ACTIVE memberships for the same user+group are still impossible", async () => {
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.membership.create({
          data: { userId, groupId: groupA, role: "GUEST", status: "ACTIVE" },
        }),
      ),
    ).rejects.toThrow(/unique|23505/i);
  });
});

describe("invitation lifecycle", () => {
  const email = "invitee@lc.local";
  const week = () => new Date(Date.now() + 7 * 86_400_000);

  it("one PENDING invitation per (group, email)", async () => {
    await withGroup(db, groupA, (tx) =>
      tx.invitation.create({
        data: { groupId: groupA, email, role: "MEMBER", tokenHash: "h1", invitedById: adminId, expiresAt: week() },
      }),
    );
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.invitation.create({
          data: { groupId: groupA, email, role: "MEMBER", tokenHash: "h2", invitedById: adminId, expiresAt: week() },
        }),
      ),
    ).rejects.toThrow(/unique|23505/i);
  });

  it("an accepted invitation frees the slot for a new pending one", async () => {
    await withGroup(db, groupA, (tx) =>
      tx.invitation.updateMany({ where: { email }, data: { acceptedAt: new Date() } }),
    );
    const again = await withGroup(db, groupA, (tx) =>
      tx.invitation.create({
        data: { groupId: groupA, email, role: "MEMBER", tokenHash: "h3", invitedById: adminId, expiresAt: week() },
      }),
    );
    expect(again.tokenHash).toBe("h3");
  });

  it("invitations are tenant-isolated (cross-tenant read sees nothing)", async () => {
    const fromB = await withGroup(db, groupB, (tx) => tx.invitation.findMany());
    expect(fromB).toEqual([]);
    expect(await db.invitation.findMany()).toEqual([]); // no context ⇒ nothing
  });
});
