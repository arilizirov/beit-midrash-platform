// Domain entities and pure business rules for files.
import type { AttachmentKind } from "../../../generated/prisma/enums";

export type { AttachmentKind };

/** SPEC §7: per-type ceilings, enforced AFTER upload against real bytes. */
export const MAX_BYTES: Record<AttachmentKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  PDF: 50 * 1024 * 1024,
  FILE: 25 * 1024 * 1024,
};

const ALLOWED: Record<string, AttachmentKind> = {
  "image/png": "IMAGE",
  "image/jpeg": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "application/pdf": "PDF",
};

/**
 * Classify by CONTENT TYPE, never by file extension — the extension is the
 * client's word, and it is the easiest thing in an upload to lie about.
 * Anything unrecognised is FILE (generic, smallest ceiling), not rejected:
 * a study group legitimately shares odd formats.
 */
export function kindFor(mimeType: string): AttachmentKind {
  return ALLOWED[mimeType.toLowerCase()] ?? "FILE";
}

export function maxBytesFor(mimeType: string): number {
  return MAX_BYTES[kindFor(mimeType)];
}
