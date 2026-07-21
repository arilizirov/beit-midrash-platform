/**
 * Attachments (SPEC §4/§7). The upload contract is two-phase: we presign, the
 * client PUTs straight to storage, then we CONFIRM against what actually
 * landed. Most of these tests are about what happens when a client lies —
 * that is the whole reason phase two exists.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { appUrl } from "../../../test/db-url";
import { createClient, type PrismaClient } from "../../platform/db";
import { createMemoryStorage } from "../../platform/storage";
import { withGroup } from "../../platform/tenancy";

import {
  confirmUpload,
  downloadUrl,
  listAttachments,
  startUpload,
} from "./service";

let db: PrismaClient;
let storage: ReturnType<typeof createMemoryStorage>;
let groupA: string, groupB: string, userId: string;

beforeAll(async () => {
  db = createClient(appUrl());
  storage = createMemoryStorage();
  groupA = (await db.group.create({ data: { slug: "fil-a", name: "חבורה" } })).id;
  groupB = (await db.group.create({ data: { slug: "fil-b", name: "אחרת" } })).id;
  userId = (await db.user.create({ data: { email: "up@fil.local" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
});

const target = { entityType: "NOTE", entityId: "note-1" } as const;

/** Presign + land bytes, without confirming. */
async function land(groupId: string, fileName: string, mimeType: string, bytes = 5) {
  const started = await startUpload(storage, { groupId, ...target, fileName, mimeType });
  storage.__put(started.key, bytes, mimeType);
  return started;
}

describe("upload contract", () => {
  it("presigns a tenant-namespaced key and records nothing yet", async () => {
    const started = await startUpload(storage, {
      groupId: groupA,
      ...target,
      fileName: "מקור.pdf",
      mimeType: "application/pdf",
    });
    expect(started.key.startsWith(`${groupA}/`)).toBe(true);
    // nothing is recorded until the bytes actually exist
    expect(await listAttachments(db, groupA, target.entityType, target.entityId)).toEqual([]);
  });

  it("confirm refuses when the object never arrived", async () => {
    const started = await startUpload(storage, {
      groupId: groupA,
      ...target,
      fileName: "ghost.pdf",
      mimeType: "application/pdf",
    });
    await expect(
      confirmUpload(db, storage, {
        groupId: groupA,
        key: started.key,
        uploadedById: userId,
        ...target,
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("records the size STORAGE reports, not what the client claimed", async () => {
    const started = await startUpload(storage, {
      groupId: groupA,
      ...target,
      fileName: "תמונה.png",
      mimeType: "image/png",
    });
    // what actually landed disagrees with the declared type and size
    storage.__put(started.key, 4242, "application/pdf");
    const att = await confirmUpload(db, storage, {
      groupId: groupA,
      key: started.key,
      uploadedById: userId,
      ...target,
    });
    expect(att.sizeBytes).toBe(4242);
    expect(att.mimeType).toBe("application/pdf");
    expect(att.kind).toBe("PDF");
  });

  it("rejects an oversized object even though the presign allowed the attempt", async () => {
    const started = await startUpload(storage, {
      groupId: groupA,
      ...target,
      fileName: "huge.pdf",
      mimeType: "application/pdf",
    });
    storage.__put(started.key, started.maxBytes + 1, "application/pdf");
    await expect(
      confirmUpload(db, storage, {
        groupId: groupA,
        key: started.key,
        uploadedById: userId,
        ...target,
      }),
    ).rejects.toThrow(/too large/i);
  });

  it("refuses a key belonging to another tenant", async () => {
    const started = await land(groupB, "theirs.pdf", "application/pdf", 10);
    await expect(
      confirmUpload(db, storage, {
        groupId: groupA,
        key: started.key,
        uploadedById: userId,
        ...target,
      }),
    ).rejects.toThrow(/tenant/i);
  });

  it("refuses a malformed key before storage is touched", async () => {
    for (const bad of [
      `${groupA}/`, // empty id → would have become an empty primary key
      `${groupA}/abcdefghijklmnopqrstuv/x/y`, // extra segments silently dropped
      `${groupA}/../${groupB}/x`, // traversal survives a prefix check
      "other/abcdefghijklmnopqrstuv/x",
    ]) {
      await expect(
        confirmUpload(db, storage, {
          groupId: groupA,
          key: bad,
          uploadedById: userId,
          ...target,
        }),
      ).rejects.toThrow(/tenant|malformed/i);
    }
  });

  it("attachments are invisible across the tenant wall", async () => {
    const started = await land(groupA, "private.pdf", "application/pdf");
    const att = await confirmUpload(db, storage, {
      groupId: groupA,
      key: started.key,
      uploadedById: userId,
      ...target,
    });
    // POSITIVE CONTROL FIRST — without it, the empty-list assertion below
    // would pass even with the tenant policy dropped entirely.
    const mine = await listAttachments(db, groupA, target.entityType, target.entityId);
    expect(mine.map((a) => a.id)).toContain(att.id);

    expect(await listAttachments(db, groupB, target.entityType, target.entityId)).toEqual([]);
    expect(
      await withGroup(db, groupB, (tx) => tx.attachment.findFirst({ where: { id: att.id } })),
    ).toBeNull();
  });

  it("lists in creation order and never hands the object key to callers", async () => {
    const t2 = { entityType: "NOTE", entityId: "note-order" } as const;
    for (const name of ["first.pdf", "second.pdf"]) {
      const s = await startUpload(storage, {
        groupId: groupA,
        ...t2,
        fileName: name,
        mimeType: "application/pdf",
      });
      storage.__put(s.key, 3, "application/pdf");
      await confirmUpload(db, storage, {
        groupId: groupA,
        key: s.key,
        uploadedById: userId,
        ...t2,
        fileName: name,
      });
    }
    const rows = await listAttachments(db, groupA, t2.entityType, t2.entityId);
    expect(rows.map((r) => r.fileName)).toEqual(["first.pdf", "second.pdf"]);
    // downloads go through downloadUrl(id); leaking keys would let a client
    // ask for any object it could guess
    expect(Object.keys(rows[0]!)).not.toContain("objectKey");
  });

  it("downloadUrl issues a URL for our own row and refuses another tenant's", async () => {
    const s = await land(groupA, "mine.pdf", "application/pdf", 3);
    const att = await confirmUpload(db, storage, {
      groupId: groupA,
      key: s.key,
      uploadedById: userId,
      ...target,
    });
    await expect(downloadUrl(db, storage, groupA, att.id)).resolves.toContain("memory://download");
    await expect(downloadUrl(db, storage, groupB, att.id)).rejects.toThrow(/not found/i);
  });
});
