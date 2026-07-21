/**
 * SPEC §8: Hebrew search rests on ONE normalizer, `bm_normalize`, applied to
 * both the stored text and the query so the two always fold the same way.
 * Postgres ships no Hebrew stemmer, so this is a deliberate normalize+trigram
 * strategy — and §8 requires the result be MEASURED, not assumed (see
 * search-exit-criterion.test.ts).
 *
 * Lives beside platform/db because what is under test is a DATABASE object (a
 * function and two generated columns), not a service. SearchService itself
 * belongs in features/search per docs/ARCHITECTURE.md, and lands with it.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { withGroup } from "../tenancy";

import { createClient, type PrismaClient } from "./index";

let db: PrismaClient;
let groupId: string, userId: string;

const norm = async (s: string) =>
  (await db.$queryRaw<{ out: string }[]>`SELECT bm_normalize(${s}::text) AS out`)[0]!.out;

beforeAll(async () => {
  db = createClient(appUrl());
  groupId = (await db.group.create({ data: { slug: "srch", name: "חבורה" } })).id;
  userId = (await db.user.create({ data: { email: "s@srch.local" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

describe("bm_normalize", () => {
  it("strips nikud and cantillation", async () => {
    expect(await norm("שָׁלוֹם")).toBe(await norm("שלום"));
    expect(await norm("בְּרֵאשִׁ֖ית")).toBe("בראשית");
  });

  it("KEEPS maqaf — stripping it welds two words into one", async () => {
    // The literal range 0591-05C7 swallows maqaf (05BE), paseq, sof pasuq and
    // nun hafukha, which are punctuation living inside the Hebrew block. This
    // test is the reason the migration uses explicit codepoints.
    expect(await norm("בֵּית־הַמִּדְרָשׁ")).toBe("בית־המדרש");
  });

  it("folds precomposed presentation forms to their base letters", async () => {
    // U+FB2A (שׁ) vs base shin + dot. Text copied out of a PDF or a siddur app
    // routinely uses the precomposed forms; without NFKD they survive as
    // different tokens and never match what someone typed.
    expect(await norm("שׁלום")).toBe(await norm("שלום"));
    expect(await norm("ﭏהים")).toBe(await norm("אלהים"));
  });

  it("drops the invisible characters that ride along with a paste", async () => {
    // RLM/LRM/ZWSP/BOM from Word, PDFs and web pages; NBSP folded to a space.
    // Without this a pasted title matches nothing and nothing reports an error.
    expect(await norm("‏שלום‎")).toBe(await norm("שלום"));
    expect(await norm("﻿שלום")).toBe(await norm("שלום"));
    expect(await norm("בית המדרש")).toBe("בית המדרש");
  });

  it("drops geresh/gershayim so abbreviations match however they were typed", async () => {
    expect(await norm("ר״ת")).toBe("רת");
    expect(await norm("ג׳")).toBe("ג");
  });

  it("folds final letters so a singular is a prefix of its plural", async () => {
    // NOTE this helps the TRIGRAM path only — under `simple`, שלומ and שלומימ
    // remain distinct lexemes, so tsvector alone still will not bridge them.
    expect((await norm("שלומים")).startsWith(await norm("שלום"))).toBe(true);
  });

  it("lower-cases Latin so source refs match either way", async () => {
    expect(await norm("Zevachim 19A")).toBe("zevachim 19a");
  });
});

describe("generated search columns", () => {
  it("are indexed, and only for live rows", async () => {
    const idx = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'Topic' AND indexname IN ('Topic_searchVector_idx', 'Topic_searchText_idx')`;
    expect(idx).toHaveLength(2);
    // partial, like every other index here: a soft-deleted topic is hidden
    // everywhere else and must not reappear through search
    for (const i of idx) expect(i.indexdef).toContain('"deletedAt" IS NULL');
  });

  it("populate themselves and re-compute when the row changes", async () => {
    const topic = await withGroup(db, groupId, (tx) =>
      tx.topic.create({
        data: {
          groupId,
          title: "פְּסוּל מַחְשָׁבָה בִּזְבָחִים",
          description: "דיון בסוגיה",
          slug: "gen-1",
          authorId: userId,
        },
      }),
    );
    // RLS is FORCEd on Topic, so even a raw read needs the tenant context.
    const [row] = await withGroup(db, groupId, (tx) =>
      tx.$queryRaw<{ searchText: string; vec: string }[]>`
        SELECT "searchText", "searchVector"::text AS vec FROM "Topic" WHERE id = ${topic.id}`,
    );
    expect(row!.searchText).toContain("פסול");
    // title outranks description (a LOCAL decision, recorded in STACK.md):
    // tsvector renders the weight next to the position, so `:3A` / `:5B`.
    expect(row!.vec).toMatch(/בזבחימ':\d+A/);
    expect(row!.vec).toMatch(/בסוגיה':\d+B/);

    await withGroup(db, groupId, (tx) =>
      tx.topic.update({ where: { id: topic.id }, data: { title: "כותרת חדשה" } }),
    );
    const [after] = await withGroup(db, groupId, (tx) =>
      tx.$queryRaw<{ searchText: string }[]>`
        SELECT "searchText" FROM "Topic" WHERE id = ${topic.id}`,
    );
    expect(after!.searchText).toContain("חדשה");
    expect(after!.searchText).not.toContain("פסול");
  });

  it("finds a nikud'd title from an un-nikud'd query, and the reverse", async () => {
    await withGroup(db, groupId, (tx) =>
      tx.topic.create({
        data: { groupId, title: "הִלְכוֹת שַׁבָּת", slug: "gen-2", authorId: userId },
      }),
    );
    for (const query of ["הלכות שבת", "הִלְכוֹת שַׁבָּת"]) {
      const hits = await withGroup(db, groupId, (tx) =>
        tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Topic"
          WHERE "searchVector" @@ plainto_tsquery('simple', bm_normalize(${query}::text))`,
      );
      expect(hits.length).toBeGreaterThan(0);
    }
  });

  it("answers a partial word through pg_trgm similarity", async () => {
    // `%` is the trigram operator: without CREATE EXTENSION pg_trgm this
    // query errors outright, so unlike LIKE it cannot pass by sequential scan.
    const hits = await withGroup(db, groupId, (tx) =>
      tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Topic" WHERE "searchText" % bm_normalize('הלכת שבת'::text)`,
    );
    expect(hits.length).toBeGreaterThan(0);
  });
});
