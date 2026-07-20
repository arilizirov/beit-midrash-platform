/**
 * Layer 3 (SPEC §6): the global soft-delete read filter. List reads hide
 * deletedAt rows unless the caller names `deletedAt` explicitly
 * (`deletedAt: {}` = include history, on purpose). findUnique* and
 * mutations are documented pass-throughs.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { withGroup } from "../tenancy";

import { createClient, type PrismaClient } from "./index";

let db: PrismaClient;
let groupId: string, liveId: string, deadId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupId = (await db.group.create({ data: { slug: "sd-g", name: "קבוצה" } })).id;
  const [live, dead] = await Promise.all([
    db.user.create({ data: { email: "live@sd.local" } }),
    db.user.create({ data: { email: "dead@sd.local", deletedAt: new Date() } }),
  ]);
  liveId = live.id;
  deadId = dead.id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("global soft-delete read filter", () => {
  it("findMany/findFirst/count hide soft-deleted rows by default", async () => {
    const emails = (await db.user.findMany()).map((u) => u.email);
    expect(emails).toContain("live@sd.local");
    expect(emails).not.toContain("dead@sd.local");
    expect(await db.user.findFirst({ where: { id: deadId } })).toBeNull();
    expect(await db.user.count({ where: { id: deadId } })).toBe(0);
  });

  it("`deletedAt: {}` is the explicit include-history escape hatch", async () => {
    const all = await db.user.findMany({ where: { deletedAt: {} } });
    expect(all.map((u) => u.id)).toContain(deadId);
    const onlyDead = await db.user.findMany({ where: { deletedAt: { not: null } } });
    expect(onlyDead.map((u) => u.id)).toContain(deadId);
    expect(onlyDead.map((u) => u.id)).not.toContain(liveId);
  });

  it("mutations pass through — reactivation stays legal", async () => {
    const revived = await db.user.update({
      where: { id: deadId },
      data: { deletedAt: null },
    });
    expect(revived.deletedAt).toBeNull();
    // restore fixture state for other assertions
    await db.user.update({ where: { id: deadId }, data: { deletedAt: new Date() } });
  });

  it("documented gap: findUnique bypasses the filter (unique inputs only)", async () => {
    const viaUnique = await db.user.findUnique({ where: { id: deadId } });
    expect(viaUnique?.id).toBe(deadId); // caller must check deletedAt or use findFirst
  });

  it("composes with RLS: tenant filter AND soft-delete filter both apply", async () => {
    const m = await withGroup(db, groupId, (tx) =>
      tx.membership.create({
        data: { userId: liveId, groupId, role: "MEMBER", status: "ACTIVE" },
      }),
    );
    await withGroup(db, groupId, (tx) =>
      tx.membership.update({ where: { id: m.id }, data: { deletedAt: new Date() } }),
    );
    const visible = await withGroup(db, groupId, (tx) => tx.membership.findMany());
    expect(visible.map((r) => r.id)).not.toContain(m.id);
  });
});
