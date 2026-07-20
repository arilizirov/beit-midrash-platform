/**
 * Layer 3 (SPEC §6): the global soft-delete read filter, and — just as
 * important — its DOCUMENTED GAPS pinned as tests, so the day Prisma changes
 * one, we find out from a red build instead of a leak.
 */
import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { withGroup } from "../tenancy";

import { createClient, SOFT_DELETABLE, type PrismaClient } from "./index";

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
  it("hides tombstones from every filtered read", async () => {
    const emails = (await db.user.findMany()).map((u) => u.email);
    expect(emails).toContain("live@sd.local");
    expect(emails).not.toContain("dead@sd.local");
    expect(await db.user.findFirst({ where: { id: deadId } })).toBeNull();
    expect(await db.user.count({ where: { id: deadId } })).toBe(0);
    // aggregate/groupBy counted tombstones before this slice (verified) —
    // the north-star metrics are built on exactly these two.
    const agg = await db.user.aggregate({ _count: { _all: true }, where: { id: deadId } });
    expect(agg._count._all).toBe(0);
    const grouped = await db.user.groupBy({
      by: ["status"],
      where: { id: deadId },
      _count: { _all: true },
    });
    expect(grouped).toEqual([]);
  });

  it("fails CLOSED on an explicitly-undefined deletedAt (the `in` trap)", async () => {
    // `where: { deletedAt: someUndefinedVar }` has the key present but
    // constrains nothing; a key-presence check skipped the filter and leaked.
    const maybe = undefined;
    const rows = await db.user.findMany({ where: { id: deadId, deletedAt: maybe } });
    expect(rows).toEqual([]);
  });

  it("does not mutate the caller's args object", async () => {
    const shared: { where: { id: string } } = { where: { id: deadId } };
    await db.user.findMany(shared);
    // A reused args object must not carry an injected deletedAt into the
    // next, deliberately-unfiltered call.
    expect("deletedAt" in shared.where).toBe(false);
  });

  it("`deletedAt: {}` is the explicit include-history escape hatch", async () => {
    const all = await db.user.findMany({ where: { deletedAt: {} } });
    expect(all.map((u) => u.id)).toContain(deadId);
    const onlyDead = await db.user.findMany({ where: { deletedAt: { not: null } } });
    expect(onlyDead.map((u) => u.id)).toContain(deadId);
    expect(onlyDead.map((u) => u.id)).not.toContain(liveId);
  });

  it("mutations pass through — reactivation stays legal", async () => {
    try {
      const revived = await db.user.update({ where: { id: deadId }, data: { deletedAt: null } });
      expect(revived.deletedAt).toBeNull();
    } finally {
      // restore in finally: a failed assertion must not poison later tests
      await db.user.update({ where: { id: deadId }, data: { deletedAt: new Date() } });
    }
  });

  it("composes with RLS: tenant filter AND soft-delete filter both apply", async () => {
    const m = await withGroup(db, groupId, (tx) =>
      tx.membership.create({ data: { userId: liveId, groupId, role: "MEMBER", status: "ACTIVE" } }),
    );
    await withGroup(db, groupId, (tx) =>
      tx.membership.update({ where: { id: m.id }, data: { deletedAt: new Date() } }),
    );
    const visible = await withGroup(db, groupId, (tx) => tx.membership.findMany());
    expect(visible.map((r) => r.id)).not.toContain(m.id);
  });
});

describe("documented gaps (pinned — a change here is news, not a silent leak)", () => {
  it("findUnique bypasses the filter (unique inputs only)", async () => {
    const viaUnique = await db.user.findUnique({ where: { id: deadId } });
    expect(viaUnique?.id).toBe(deadId);
  });

  it("relation reads via include are NOT filtered — nested reads need manual care", async () => {
    const m = await withGroup(db, groupId, (tx) =>
      tx.membership.create({ data: { userId: liveId, groupId, role: "GUEST", status: "ACTIVE" } }),
    );
    await withGroup(db, groupId, (tx) =>
      tx.membership.update({ where: { id: m.id }, data: { deletedAt: new Date() } }),
    );
    const withRel = await withGroup(db, groupId, (tx) =>
      tx.group.findFirst({ where: { id: groupId }, include: { memberships: true } }),
    );
    // Extensions intercept only the top-level operation: the tombstoned
    // membership DOES come back through the relation.
    expect(withRel?.memberships.map((r) => r.id)).toContain(m.id);
  });
});

describe("SOFT_DELETABLE drift guard", () => {
  it("lists exactly the models that declare deletedAt in the schema", () => {
    // Prisma 7's client exposes no dmmf (verified), so the schema file is
    // the source of truth — a new soft-deletable entity that forgets to
    // register here turns this red instead of leaking tombstones.
    const schema = readFileSync("prisma/schema.prisma", "utf8");
    const declared = new Set<string>();
    for (const block of schema.split(/^model\s+/m).slice(1)) {
      const name = block.slice(0, block.indexOf(" ")).trim();
      const body = block.slice(0, block.indexOf("\n}"));
      if (/^\s*deletedAt\s+DateTime\?/m.test(body)) declared.add(name);
    }
    expect([...declared].sort()).toEqual([...SOFT_DELETABLE].sort());
  });
});
