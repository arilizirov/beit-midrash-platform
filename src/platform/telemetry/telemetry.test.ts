/**
 * SPEC §4: ActivityLog/EventLog are append-only — enforced at the DATABASE
 * (no UPDATE/DELETE policy under FORCEd RLS), not as a code convention.
 * (That mutations write audit rows in-tx is asserted in the feature tests —
 * platform tests must not import features; boundaries forbid it.)
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";
import { withGroup } from "../tenancy";

import { logActivity, logEvent } from "./index";

let db: PrismaClient;
let groupA: string, groupB: string;

beforeAll(async () => {
  db = createClient(appUrl());
  groupA = (await db.group.create({ data: { slug: "tel-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "tel-b", name: "אחרת" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("ActivityLog", () => {
  it("logActivity writes inside the caller's transaction", async () => {
    await withGroup(db, groupA, async (tx) => {
      await logActivity(tx, {
        groupId: groupA,
        action: "test.action",
        entityType: "TEST",
        entityId: "e1",
      });
    });
    const rows = await withGroup(db, groupA, (tx) => tx.activityLog.findMany());
    expect(rows.map((r) => r.action)).toContain("test.action");
  });

  it("history cannot be rewritten: UPDATE and DELETE are denied BY THE DATABASE", async () => {
    const row = await withGroup(db, groupA, (tx) => tx.activityLog.findFirstOrThrow());
    const upd = await withGroup(db, groupA, (tx) =>
      tx.activityLog.updateMany({ where: { id: row.id }, data: { action: "forged" } }),
    );
    expect(upd.count).toBe(0);
    const del = await withGroup(db, groupA, (tx) =>
      tx.activityLog.deleteMany({ where: { id: row.id } }),
    );
    expect(del.count).toBe(0);
    const intact = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findFirst({ where: { id: row.id } }),
    );
    expect(intact?.action).toBe("test.action");
  });

  it("audit trails are tenant-isolated like everything else", async () => {
    expect(await withGroup(db, groupB, (tx) => tx.activityLog.findMany())).toEqual([]);
    expect(await db.activityLog.findMany()).toEqual([]); // no context ⇒ nothing
  });
});

describe("EventLog", () => {
  it("records reads and never throws into the caller", async () => {
    await logEvent(db, { groupId: groupA, event: "search.run", metadata: { q: "זבחים" } });
    const rows = await withGroup(db, groupA, (tx) => tx.eventLog.findMany());
    expect(rows.some((r) => r.event === "search.run")).toBe(true);
    // NOTE: the failing-path (swallow + no row) is only provable once
    // groupId FKs exist — that test ships WITH the FK migration (next PR).
  });

  it("events are DB-append-only too", async () => {
    const del = await withGroup(db, groupA, (tx) => tx.eventLog.deleteMany());
    expect(del.count).toBe(0);
  });
});
