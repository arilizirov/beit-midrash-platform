/**
 * Invitation flow (SPEC §4/§6, ADR 0002): create (supersede) → preview →
 * ensureInvitedUser → completeAccept. All group-scoped ops run under RLS via
 * withGroup; tokens live only as SHA-256 hashes.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";

import {
  completeAccept,
  createInvitation,
  ensureInvitedUser,
  previewInvitation,
} from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, adminId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "inv-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "inv-b", name: "אחרת" } })).id;
  adminId = (await db.user.create({ data: { email: "admin@inv.local" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("invitation flow", () => {
  it("creates an invitation and stores only the token hash", async () => {
    const { rawToken, invitation } = await createInvitation(db, {
      groupId: groupA,
      email: "Chaver@Inv.Local", // mixed case on purpose
      role: "MEMBER",
      invitedById: adminId,
    });
    expect(rawToken).toHaveLength(43); // 32 bytes base64url
    expect(invitation.email).toBe("chaver@inv.local"); // normalized
    const { createHash } = await import("node:crypto");
    expect(invitation.tokenHash).toBe(createHash("sha256").update(rawToken).digest("hex"));
    expect(invitation.tokenHash).toHaveLength(64);
  });

  it("re-inviting supersedes the pending invitation (old token dies)", async () => {
    const first = await createInvitation(db, {
      groupId: groupA, email: "twice@inv.local", role: "MEMBER", invitedById: adminId,
    });
    const second = await createInvitation(db, {
      groupId: groupA, email: "twice@inv.local", role: "EDITOR", invitedById: adminId,
    });
    expect(await previewInvitation(db, groupA, first.rawToken)).toBeNull();
    const live = await previewInvitation(db, groupA, second.rawToken);
    expect(live?.role).toBe("EDITOR");
  });

  it("a token is worthless against another group (RLS)", async () => {
    const { rawToken } = await createInvitation(db, {
      groupId: groupA, email: "scoped@inv.local", role: "MEMBER", invitedById: adminId,
    });
    expect(await previewInvitation(db, groupB, rawToken)).toBeNull();
  });

  it("expired invitations do not preview", async () => {
    const { rawToken, invitation } = await createInvitation(db, {
      groupId: groupA, email: "late@inv.local", role: "MEMBER", invitedById: adminId,
    });
    await import("../../platform/tenancy").then(({ withGroup }) =>
      withGroup(db, groupA, (tx) =>
        tx.invitation.update({ where: { id: invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } }),
      ),
    );
    expect(await previewInvitation(db, groupA, rawToken)).toBeNull();
  });

  it("full accept: user created (normalized), membership created with the invited role, single-use", async () => {
    const { rawToken } = await createInvitation(db, {
      groupId: groupA, email: "Newcomer@Inv.Local", role: "EDITOR", invitedById: adminId,
    });
    const user = await ensureInvitedUser(db, groupA, rawToken);
    expect(user?.email).toBe("newcomer@inv.local");

    const done = await completeAccept(db, {
      groupId: groupA, rawToken, userId: user!.id, userEmail: "newcomer@inv.local",
    });
    expect(done.ok).toBe(true);

    const { withGroup } = await import("../../platform/tenancy");
    const membership = await withGroup(db, groupA, (tx) =>
      tx.membership.findFirst({ where: { userId: user!.id, deletedAt: null } }),
    );
    expect(membership?.role).toBe("EDITOR");
    expect(membership?.status).toBe("ACTIVE");

    // single-use: the same token cannot mint a second membership
    const again = await completeAccept(db, {
      groupId: groupA, rawToken, userId: user!.id, userEmail: "newcomer@inv.local",
    });
    expect(again.ok).toBe(false);
  });

  it("an invite does NOT lift a global suspension (moderation outranks invitation)", async () => {
    await db.user.create({ data: { email: "banned@inv.local", status: "SUSPENDED" } });
    const { rawToken } = await createInvitation(db, {
      groupId: groupA, email: "banned@inv.local", role: "MEMBER", invitedById: adminId,
    });
    expect(await ensureInvitedUser(db, groupA, rawToken)).toBeNull();
    const still = await db.user.findFirst({ where: { email: "banned@inv.local" } });
    expect(still?.status).toBe("SUSPENDED");
  });

  it("an existing active member does not consume the token (already_member)", async () => {
    const member = await db.user.create({ data: { email: "veteran@inv.local" } });
    const { withGroup } = await import("../../platform/tenancy");
    await withGroup(db, groupA, (tx) =>
      tx.membership.create({
        data: { userId: member.id, groupId: groupA, role: "MEMBER", status: "ACTIVE" },
      }),
    );
    const { rawToken } = await createInvitation(db, {
      groupId: groupA, email: "veteran@inv.local", role: "ADMIN", invitedById: adminId,
    });
    const res = await completeAccept(db, {
      groupId: groupA, rawToken, userId: member.id, userEmail: "veteran@inv.local",
    });
    expect(res).toEqual({ ok: false, reason: "already_member" });
    expect(await previewInvitation(db, groupA, rawToken)).not.toBeNull(); // token NOT consumed
  });

  it("a double-submit race never throws and yields exactly one membership", async () => {
    const { rawToken } = await createInvitation(db, {
      groupId: groupA, email: "eager@inv.local", role: "MEMBER", invitedById: adminId,
    });
    const user = await ensureInvitedUser(db, groupA, rawToken);
    const args = { groupId: groupA, rawToken, userId: user!.id, userEmail: "eager@inv.local" };
    const [a, b] = await Promise.all([completeAccept(db, args), completeAccept(db, args)]);
    expect([a.ok, b.ok]).toContain(true); // at least one success, neither throws
    const { withGroup } = await import("../../platform/tenancy");
    const rows = await withGroup(db, groupA, (tx) =>
      tx.membership.findMany({ where: { userId: user!.id, deletedAt: null } }),
    );
    expect(rows).toHaveLength(1);
  });

  it("a session with a different email cannot hijack the invitation", async () => {
    const { rawToken } = await createInvitation(db, {
      groupId: groupA, email: "intended@inv.local", role: "MEMBER", invitedById: adminId,
    });
    const mallory = await db.user.create({ data: { email: "mallory@inv.local" } });
    const res = await completeAccept(db, {
      groupId: groupA, rawToken, userId: mallory.id, userEmail: "mallory@inv.local",
    });
    expect(res.ok).toBe(false);
  });
});
