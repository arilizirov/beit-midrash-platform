/**
 * The viewer half of the tenancy seam. `withGroup` sets `app.user_id` on every
 * transaction so a policy can ask WHO is reading — the first user is the Note
 * policy in the next slice.
 *
 * These tests exist because the setting is invisible: nothing else in the app
 * reads it yet, so a regression here would go unnoticed until it surfaced as
 * a privacy bug in a feature that trusts it.
 *
 * HONEST LIMIT, established by sabotage rather than assumed. Two independent
 * mechanisms keep a viewer from bleeding between transactions: the setting is
 * transaction-local, AND it is rewritten on every transaction. Either alone is
 * sufficient, so each MASKS the other — switching set_config to session-scoped
 * leaves these tests green, and so does skipping the write when no viewer is
 * given. What follows therefore pins the observable BEHAVIOUR, not either
 * mechanism. Reproducing a non-local default (ALTER ROLE / postgresql.conf)
 * against a pooled connection is not something a test here can do reliably.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";

import { withGroup } from "./index";

let db: PrismaClient;
let groupId: string;

const readSettings = (tx: {
  $queryRaw: (q: TemplateStringsArray) => Promise<{ g: string; u: string }[]>;
}) => tx.$queryRaw`SELECT current_setting('app.group_id', true) AS g, current_setting('app.user_id', true) AS u`;

beforeAll(async () => {
  db = createClient(appUrl());
  groupId = (await db.group.create({ data: { slug: `vw-${Date.now()}`, name: "חבורה" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("withGroup viewer context", () => {
  it("makes the viewer readable inside the transaction", async () => {
    const [row] = await withGroup(db, groupId, (tx) => readSettings(tx), { viewerId: "user-123" });
    expect(row).toEqual({ g: groupId, u: "user-123" });
  });

  it("reads back an EMPTY viewer when none is given", async () => {
    // "" is a value no id can equal (cuid2 — ADR 0003), so a policy comparing
    // against it matches nothing: a forgotten viewer hides rows, never leaks
    // them. This asserts the value seen by policies, not how it got there.
    const [row] = await withGroup(db, groupId, (tx) => readSettings(tx));
    expect(row.u).toBe("");
  });

  it("does not carry one transaction's viewer into the next", async () => {
    // The property that matters: one request's identity must never answer the
    // next request's queries. Guarded twice over (see the header note), which
    // is why this stays green under either mechanism alone.
    await withGroup(db, groupId, (tx) => readSettings(tx), { viewerId: "first-user" });
    const [row] = await withGroup(db, groupId, (tx) => readSettings(tx));
    expect(row.u).toBe("");
  });

  it("still passes real transaction options through to Prisma", async () => {
    // viewerId is destructured out before the options reach $transaction;
    // this is the check that the rest of the object still arrives.
    const [row] = await withGroup(db, groupId, (tx) => readSettings(tx), {
      viewerId: "u",
      isolationLevel: "RepeatableRead",
      timeout: 10_000,
    });
    expect(row.u).toBe("u");
    const [{ level }] = await withGroup(
      db,
      groupId,
      (tx) =>
        tx.$queryRaw`SELECT current_setting('transaction_isolation') AS level` as Promise<
          { level: string }[]
        >,
      { isolationLevel: "RepeatableRead" },
    );
    expect(level).toBe("repeatable read");
  });
});
