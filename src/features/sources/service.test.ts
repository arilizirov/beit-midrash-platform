/**
 * Sources service (SPEC §4, §9): normalize → find-or-create → cite. The
 * property worth most care is dedup — a ref is normalized to ONE canonical
 * string and reused, even when two callers race to create it at once.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import {
  addCitation,
  findOrCreateSource,
  listCitationsForEntity,
  listCitationsForSource,
} from "./service";

let db: PrismaClient;
let groupA: string, groupB: string, userId: string;

const create = (groupId: string, raw: string) =>
  findOrCreateSource(db, { groupId, createdById: userId, raw });

beforeAll(async () => {
  db = createClient(appUrl());
  const s = Date.now();
  groupA = (await db.group.create({ data: { slug: `svc-a-${s}`, name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: `svc-b-${s}`, name: "אחרת" } })).id;
  userId = (await db.user.create({ data: { email: `svc-${s}@t.local` } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("findOrCreateSource", () => {
  it("normalizes a raw ref into a stored Source with canonical parts", async () => {
    const r = await create(groupA, "Shabbos 21a");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source.ref).toBe("Shabbat 21a");
      expect(r.source.hebrewRef).toBe("שבת כ״א ע״א");
      expect(r.source.workCategory).toBe("TALMUD_BAVLI");
      expect(r.source.workTitle).toBe("Shabbat");
    }
  });

  it("reuses the one row for every spelling of the same ref (dedup)", async () => {
    const a = await create(groupA, "Zevachim 19a");
    const b = await create(groupA, "זבחים י״ט ע״א"); // Hebrew spelling of the same daf
    const c = await create(groupA, "  ZEVACHIM  19A "); // messy spelling
    expect(a.ok && b.ok && c.ok).toBe(true);
    if (a.ok && b.ok && c.ok) {
      expect(b.source.id).toBe(a.source.id);
      expect(c.source.id).toBe(a.source.id);
    }
  });

  it("returns a typed rejection for a bad ref, never a throw", async () => {
    const r = await create(groupA, "Zevachim 19"); // no amud
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("MISSING_AMUD");
  });

  it("parallel calls for the same ref never create a duplicate row", async () => {
    const [a, b] = await Promise.all([create(groupA, "Menachot 29b"), create(groupA, "Menachot 29b")]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.source.id).toBe(b.source.id);
    const rows = await withGroup(db, groupA, (tx) =>
      tx.source.findMany({ where: { ref: "Menachot 29b" } }),
    );
    expect(rows).toHaveLength(1);
  });

  it("recovers from a lost create race by retrying and returning the winner's row", async () => {
    // The parallel test above can't force the interleaving deterministically —
    // in-process the two transactions serialize. So inject the race: the first
    // findFirst misses (as it would mid-race), the first create hits the P2002
    // the partial unique raises, and the retry's findFirst returns the row the
    // "winner" committed. Without the retry this P2002 escapes to the caller.
    const winner = await create(groupA, "Gittin 2a");
    if (!winner.ok) throw new Error("setup failed");

    let finds = 0;
    let creates = 0;
    const racy = db.$extends({
      query: {
        source: {
          findFirst({ args, query }) {
            finds += 1;
            return finds === 1 ? Promise.resolve(null) : query(args);
          },
          create({ args, query }) {
            creates += 1;
            if (creates === 1) throw Object.assign(new Error("duplicate"), { code: "P2002" });
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;

    const r = await findOrCreateSource(racy, { groupId: groupA, createdById: userId, raw: "Gittin 2a" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source.id).toBe(winner.source.id);
    expect(finds).toBe(2); // proved the retry ran
  });

  it("dedup is per-tenant — the same ref is a separate row in another group", async () => {
    const a = await create(groupA, "Sukkah 2a");
    const b = await create(groupB, "Sukkah 2a");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.source.id).not.toBe(b.source.id);
  });

  it("audits the creation but not a reuse", async () => {
    const first = await create(groupA, "Yoma 15b");
    await create(groupA, "Yoma 15b"); // reuse — no second audit row
    if (!first.ok) throw new Error("setup failed");
    const audits = await withGroup(db, groupA, (tx) =>
      tx.activityLog.findMany({ where: { action: "source.create", entityId: first.source.id } }),
    );
    expect(audits).toHaveLength(1);
  });
});

describe("citations", () => {
  it("attaches a source to content and lists it both ways", async () => {
    const src = await create(groupA, "Chullin 17b");
    if (!src.ok) throw new Error("setup failed");
    await addCitation(db, {
      groupId: groupA,
      createdById: userId,
      sourceId: src.source.id,
      entityType: "DISCUSSION",
      entityId: "disc-1",
      note: "brought as a proof",
    });

    const bySource = await listCitationsForSource(db, groupA, src.source.id);
    expect(bySource.map((c) => c.entityId)).toEqual(["disc-1"]);
    const byEntity = await listCitationsForEntity(db, groupA, "DISCUSSION", "disc-1");
    expect(byEntity.map((c) => c.sourceId)).toEqual([src.source.id]);
  });

  it("cannot cite a source from another group (composite FK)", async () => {
    const src = await create(groupA, "Pesachim 7b");
    if (!src.ok) throw new Error("setup failed");
    await expect(
      addCitation(db, {
        groupId: groupB,
        createdById: userId,
        sourceId: src.source.id,
        entityType: "NOTE",
        entityId: "n-1",
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
