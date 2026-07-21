/**
 * SPEC §10.1 launch gate: cross-tenant read/write MUST fail.
 *
 * Connects as the non-superuser app role (superusers bypass RLS — test #1
 * guards that this suite can never silently become vacuous), then proves the
 * Membership wall in every direction: read, update, insert, and no-context.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../db";
import { withGroup } from "./index";

let db: PrismaClient;
let groupA: string, groupB: string, memberA: string, memberB: string;

beforeAll(async () => {
  db = createClient(appUrl());

  // Groups and Users are tenancy anchors (no groupId), writable without context.
  const [a, b] = await Promise.all([
    db.group.create({ data: { slug: "group-a", name: "חבורה א" } }),
    db.group.create({ data: { slug: "group-b", name: "חבורה ב" } }),
  ]);
  groupA = a.id;
  groupB = b.id;
  const [ua, ub] = await Promise.all([
    db.user.create({ data: { email: "a@test.local" } }),
    db.user.create({ data: { email: "b@test.local" } }),
  ]);

  // Memberships are RLS-bound: each must be created inside its own context.
  memberA = (
    await withGroup(db, groupA, (tx) =>
      tx.membership.create({
        data: { userId: ua.id, groupId: groupA, role: "OWNER", status: "ACTIVE" },
      }),
    )
  ).id;
  memberB = (
    await withGroup(db, groupB, (tx) =>
      tx.membership.create({
        data: { userId: ub.id, groupId: groupB, role: "OWNER", status: "ACTIVE" },
      }),
    )
  ).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("RLS tenant isolation (Membership)", () => {
  it("guards its own validity: the test role is neither superuser nor BYPASSRLS", async () => {
    const [role] = await db.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
      SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    expect(role.rolsuper).toBe(false);
    expect(role.rolbypassrls).toBe(false);
  });

  it("sees only its own group's rows", async () => {
    const rows = await withGroup(db, groupA, (tx) => tx.membership.findMany());
    expect(rows.map((r) => r.id)).toEqual([memberA]);
  });

  it("cannot read another group's row even by exact id", async () => {
    const row = await withGroup(db, groupA, (tx) =>
      tx.membership.findFirst({ where: { id: memberB } }),
    );
    expect(row).toBeNull();
  });

  it("cross-tenant UPDATE affects zero rows", async () => {
    const res = await withGroup(db, groupA, (tx) =>
      tx.membership.updateMany({ where: { id: memberB }, data: { status: "SUSPENDED" } }),
    );
    expect(res.count).toBe(0);
    const untouched = await withGroup(db, groupB, (tx) =>
      tx.membership.findFirst({ where: { id: memberB } }),
    );
    expect(untouched?.status).toBe("ACTIVE");
  });

  it("cross-tenant INSERT is rejected (WITH CHECK)", async () => {
    const user = await db.user.create({ data: { email: "c@test.local" } });
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.membership.create({
          data: { userId: user.id, groupId: groupB, role: "MEMBER", status: "ACTIVE" },
        }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("cross-tenant DELETE affects zero rows", async () => {
    const res = await withGroup(db, groupA, (tx) =>
      tx.membership.deleteMany({ where: { id: memberB } }),
    );
    expect(res.count).toBe(0);
  });

  it("no tenant context ⇒ nothing visible, nothing deletable (fail-closed)", async () => {
    expect(await db.membership.findMany()).toEqual([]);
    expect((await db.membership.deleteMany()).count).toBe(0);
  });

  // Auditor (F1): nothing mechanical forces future groupId tables to enroll in
  // RLS — so THIS does. Any table carrying groupId that lacks ENABLE+FORCE+a
  // policy turns this red the moment its migration lands.
  it("every table carrying groupId is enrolled in FORCED RLS with ≥1 policy", async () => {
    const offenders = await db.$queryRaw<{ table_name: string }[]>`
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN pg_class pc ON pc.relname = c.table_name
      JOIN pg_namespace n ON n.oid = pc.relnamespace AND n.nspname = 'public'
      LEFT JOIN pg_policy pol ON pol.polrelid = pc.oid
      WHERE c.table_schema = 'public' AND c.column_name = 'groupId'
      GROUP BY c.table_name, pc.relrowsecurity, pc.relforcerowsecurity
      HAVING NOT (pc.relrowsecurity AND pc.relforcerowsecurity)
          OR count(pol.oid) = 0`;
    expect(offenders).toEqual([]);
  });
});

/**
 * RLS is not the whole wall: Postgres validates FOREIGN KEYS with row
 * security OFF, so an id-only FK lets one tenant reference another tenant's
 * row even under perfect policies (this was VERIFIED to leak before the
 * composite keys landed). Carrying groupId into the key closes it
 * structurally — this test is the proof, and the alarm if anyone "simplifies"
 * a composite FK back to an id-only one.
 */
describe("composite tenant keys (FKs bypass RLS by design)", () => {
  it("a topic cannot point at another group's category", async () => {
    const s = Date.now();
    const author = await db.user.create({ data: { email: `fk-a-${s}@test.local` } });
    const foreignCat = await withGroup(db, groupB, (tx) =>
      tx.category.create({ data: { groupId: groupB, name: "זר", slug: `fkc-${s}` } }),
    );
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.topic.create({
          data: {
            groupId: groupA, title: "גנוב", slug: `fkt-${s}`,
            authorId: author.id, categoryId: foreignCat.id,
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("a tag link cannot join rows across groups", async () => {
    const s = Date.now();
    const author = await db.user.create({ data: { email: `fk-b-${s}@test.local` } });
    const mine = await withGroup(db, groupA, (tx) =>
      tx.topic.create({ data: { groupId: groupA, title: "שלי", slug: `fkm-${s}`, authorId: author.id } }),
    );
    const foreignTag = await withGroup(db, groupB, (tx) =>
      tx.tag.create({ data: { groupId: groupB, name: "זר", slug: `fkg-${s}` } }),
    );
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.topicTag.create({ data: { topicId: mine.id, tagId: foreignTag.id, groupId: groupA } }),
      ),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});

describe("transaction options", () => {
  it("defaults to READ COMMITTED and honours an explicit isolation level", async () => {
    // Postgres' default means every statement takes a NEW snapshot, so a
    // multi-statement read is not a point-in-time view. Callers that need one
    // (an export, a consistency check) must ask for it — and this proves the
    // option actually reaches the driver rather than being silently dropped.
    const def = await withGroup(db, groupA, (tx) =>
      tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`,
    );
    expect(def[0]!.transaction_isolation).toBe("read committed");

    const repeatable = await withGroup(
      db,
      groupA,
      (tx) => tx.$queryRaw<{ transaction_isolation: string }[]>`SHOW transaction_isolation`,
      { isolationLevel: "RepeatableRead" },
    );
    expect(repeatable[0]!.transaction_isolation).toBe("repeatable read");
  });
});
