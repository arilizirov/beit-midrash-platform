/**
 * Source + SourceCitation schema invariants (SPEC §4, §9). These exercise the
 * DB rules the schema can't state in Prisma — the partial-unique ref dedup, its
 * leave-and-return behaviour (ADR 0002), and the composite tenant FK. RLS
 * enrollment itself is covered by the catalog scan in tenancy/rls.test.ts.
 *
 * Runs as the non-superuser app role, through withGroup, so the policies bind.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

let db: PrismaClient;
let groupA: string, groupB: string, userId: string;

const STRUCT = {
  work: "Zevachim",
  category: "TALMUD_BAVLI",
  locator: "DAF_AMUD",
  daf: 19,
  amud: "a",
  tableVersion: 1,
  normalizerVersion: 1,
};

const makeSource = (groupId: string, ref: string) =>
  withGroup(db, groupId, (tx) =>
    tx.source.create({
      data: { groupId, workTitle: "Zevachim", workCategory: "TALMUD_BAVLI", ref, refStructured: STRUCT, createdById: userId },
    }),
  );

beforeAll(async () => {
  db = createClient(appUrl());
  const s = Date.now();
  groupA = (await db.group.create({ data: { slug: `src-a-${s}`, name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: `src-b-${s}`, name: "אחרת" } })).id;
  userId = (await db.user.create({ data: { email: `src-${s}@t.local` } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("one live Source per (groupId, ref)", () => {
  it("refuses a second LIVE source with the same ref — dedup is the point", async () => {
    await makeSource(groupA, "Zevachim 19a");
    await expect(makeSource(groupA, "Zevachim 19a")).rejects.toMatchObject({ code: "P2002" });
  });

  it("lets the ref be re-used after the source is soft-deleted (leave-and-return)", async () => {
    const src = await makeSource(groupA, "Berakhot 2a");
    await withGroup(db, groupA, (tx) =>
      tx.source.update({ where: { id: src.id }, data: { deletedAt: new Date() } }),
    );
    // A tombstoned ref must not squat the slot forever (ADR 0002).
    await expect(makeSource(groupA, "Berakhot 2a")).resolves.toBeTruthy();
  });

  it("allows the same ref in a different group — dedup is per-tenant", async () => {
    await makeSource(groupA, "Shabbat 21a");
    await expect(makeSource(groupB, "Shabbat 21a")).resolves.toBeTruthy();
  });

  it("does not show one group's sources to another (the tenant read wall)", async () => {
    const src = await makeSource(groupA, "Chullin 2a");
    // positive control, then the wall — an empty result alone proves nothing.
    expect(await withGroup(db, groupA, (tx) => tx.source.findMany({ where: { id: src.id } }))).toHaveLength(1);
    expect(await withGroup(db, groupB, (tx) => tx.source.findMany({ where: { id: src.id } }))).toEqual([]);
  });
});

describe("the DB-generated search columns populate (SPEC §8)", () => {
  it("computes searchText from workTitle + hebrewRef via bm_normalize", async () => {
    // Source's search expression differs from Topic's (it concatenates hebrewRef
    // + textHebrew for the B weight), so it is worth its own check that the
    // STORED column actually fills.
    const src = await withGroup(db, groupA, (tx) =>
      tx.source.create({
        data: {
          groupId: groupA,
          workTitle: "Menachot",
          workCategory: "TALMUD_BAVLI",
          ref: "Menachot 29b",
          refStructured: STRUCT,
          hebrewRef: "מנחות כ״ט ע״ב",
          createdById: userId,
        },
      }),
    );
    const [row] = await withGroup(
      db,
      groupA,
      (tx) =>
        tx.$queryRaw<{ searchText: string }[]>`SELECT "searchText" FROM "Source" WHERE "id" = ${src.id}`,
    );
    expect(row.searchText).toContain("menachot"); // workTitle, normalized + lowercased
    expect(row.searchText.length).toBeGreaterThan("menachot".length); // hebrewRef folded in too
  });
});

describe("citations are tenant-walled and polymorphic", () => {
  it("cannot cite a source belonging to another group (composite FK)", async () => {
    const src = await makeSource(groupA, "Sukkah 2a");
    await expect(
      withGroup(db, groupB, (tx) =>
        tx.sourceCitation.create({
          data: { groupId: groupB, sourceId: src.id, entityType: "NOTE", entityId: "x", createdById: userId },
        }),
      ),
    ).rejects.toMatchObject({ code: "P2003" });
  });

  it("allows a citation whose entityId points at nothing — it is a polymorphic discriminator with no FK", async () => {
    const src = await makeSource(groupA, "Yoma 2a");
    await expect(
      withGroup(db, groupA, (tx) =>
        tx.sourceCitation.create({
          data: { groupId: groupA, sourceId: src.id, entityType: "NOTE", entityId: "does-not-exist", createdById: userId },
        }),
      ),
    ).resolves.toBeTruthy();
  });
});
