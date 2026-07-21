// Use-cases for files. Orchestrates model + platform. No framework leakage.
import type {
  AttachmentTargetType,
  LinkRelation,
  LinkTargetType,
} from "../../../generated/prisma/enums";
import type { PrismaClient } from "../../platform/db";
import { objectKeyFor, type StorageDriver } from "../../platform/storage";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { newId } from "../../shared_kernel";

import { kindFor, maxBytesFor } from "./model";


/**
 * Phase 1 — issue a short-lived presigned PUT. Nothing is recorded yet: a row
 * created here would become a lie the moment the client abandoned the upload.
 * The id is minted now only so the object key can embed it.
 *
 * AUTHZ IS THE CALLER'S JOB (the server action gates on requireMembership).
 */
export async function startUpload(
  storage: StorageDriver,
  input: {
    groupId: string;
    entityType: AttachmentTargetType;
    entityId: string;
    fileName: string;
    mimeType: string;
  },
) {
  const attachmentId = newId();
  const key = objectKeyFor(input.groupId, attachmentId, input.fileName);
  const presigned = await storage.presignUpload({
    key,
    contentType: input.mimeType,
    maxBytes: maxBytesFor(input.mimeType),
  });
  return { ...presigned, attachmentId, entityType: input.entityType, entityId: input.entityId };
}

/**
 * Phase 2 — the security-relevant half. A presigned URL bounds WHO may write;
 * it does not bound WHAT they write, so we ask storage what actually landed.
 *
 * HONEST LIMIT: storage is authoritative for SIZE. Its reported contentType is
 * just the Content-Type header the client sent on its own PUT, echoed back —
 * so `kind` and the ceiling still rest on a client-declared type. Pinning
 * Content-Type into the signed headers (or sniffing magic bytes) is the real
 * fix and lands with the R2 driver; do not read this as verified truth.
 */
export async function confirmUpload(
  db: PrismaClient,
  storage: StorageDriver,
  input: {
    groupId: string;
    key: string;
    uploadedById: string;
    entityType: AttachmentTargetType;
    entityId: string;
    fileName?: string;
  },
) {
  // The key is client-supplied AND becomes the row's primary key, so validate
  // its exact shape rather than just its prefix: `<groupId>/<cuid2>/<name>`.
  // A bare prefix check accepted `groupA/` (empty id) and `groupA/x/y/z`
  // (silently truncated), and both guards here and in the DB are prefix
  // checks, so `..` segments would survive a normalizing storage driver.
  const parts = input.key.split("/");
  const [prefix, attachmentId, ...rest] = parts;
  const fileSegment = rest.join("/");
  if (
    prefix !== input.groupId ||
    parts.length !== 3 ||
    !/^[a-z0-9]{20,32}$/.test(attachmentId ?? "") ||
    parts.some((seg) => seg === "..")
  ) {
    throw new Error("key does not belong to this tenant (or is malformed)");
  }
  const head = await storage.head(input.key);
  if (!head) throw new Error("uploaded object not found");

  const kind = kindFor(head.contentType);
  const ceiling = maxBytesFor(head.contentType);
  if (head.sizeBytes > ceiling) {
    // Presign limits are advisory — storage may accept more than we asked for.
    await storage.delete(input.key);
    throw new Error(`uploaded object too large: ${head.sizeBytes} > ${ceiling}`);
  }

  return withGroup(db, input.groupId, async (tx) => {
    const attachment = await tx.attachment.create({
      data: {
        id: attachmentId,
        groupId: input.groupId,
        entityType: input.entityType,
        entityId: input.entityId,
        kind,
        objectKey: input.key,
        fileName: input.fileName ?? fileSegment ?? "file",
        mimeType: head.contentType,
        sizeBytes: head.sizeBytes,
        uploadedById: input.uploadedById,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "attachment.create",
      entityType: "ATTACHMENT",
      entityId: attachment.id,
      actorId: input.uploadedById,
      metadata: { kind, sizeBytes: head.sizeBytes },
    });
    return attachment;
  });
}

export async function listAttachments(
  db: PrismaClient,
  groupId: string,
  entityType: AttachmentTargetType,
  entityId: string,
) {
  return withGroup(db, groupId, (tx) =>
    tx.attachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
      },
    }),
  );
}

/**
 * A download URL is issued per request and expires — never stored. Takes an
 * attachment ID, NOT a key: the previous signature presigned any key on earth
 * with no tenant check, and `listAttachments` handed keys to clients. The row
 * is resolved inside the tenant context, so a foreign id simply does not
 * exist here.
 */
export async function downloadUrl(
  db: PrismaClient,
  storage: StorageDriver,
  groupId: string,
  attachmentId: string,
) {
  const row = await withGroup(db, groupId, (tx) =>
    tx.attachment.findFirst({ where: { id: attachmentId }, select: { objectKey: true } }),
  );
  if (!row) throw new Error("attachment not found in this group");
  return storage.presignDownload(row.objectKey);
}

/** Idempotent: the same edge twice returns the existing one. */
export async function linkContent(
  db: PrismaClient,
  input: {
    groupId: string;
    fromType: LinkTargetType;
    fromId: string;
    toType: LinkTargetType;
    toId: string;
    relation?: LinkRelation;
    createdById: string;
  },
) {
  const relation = input.relation ?? "RELATED";
  return withGroup(db, input.groupId, async (tx) => {
    const existing = await tx.internalLink.findFirst({
      where: {
        fromType: input.fromType,
        fromId: input.fromId,
        toType: input.toType,
        toId: input.toId,
        relation,
      },
    });
    if (existing) return existing;
    const created = await tx.internalLink.create({
      data: {
        groupId: input.groupId,
        fromType: input.fromType,
        fromId: input.fromId,
        toType: input.toType,
        toId: input.toId,
        relation,
        createdById: input.createdById,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "link.create",
      entityType: input.fromType,
      entityId: input.fromId,
      actorId: input.createdById,
      metadata: { toType: input.toType, toId: input.toId, relation },
    });
    return created;
  });
}
