/**
 * platform/storage — the StorageService seam (SPEC §2/§7).
 *
 * R2 (S3-compatible) holds blobs; the DB holds keys. The bucket is PRIVATE:
 * clients never touch it directly except through a short-lived presigned URL
 * we issue after checking membership, so every read and write is authorized
 * by us, not by possession of a URL.
 *
 * Deliberately an interface with a local implementation: the real R2 wiring
 * needs an account (a deploy gate), and nothing about the upload contract
 * should wait on that. Tests and dev run against the in-memory driver;
 * production swaps the driver, not the callers.
 */

/** Keys are namespaced by tenant — a DB CHECK enforces the same prefix. */
export function objectKeyFor(groupId: string, attachmentId: string, fileName: string): string {
  // `/` becomes `_`, but `.` is legal in filenames — so strip traversal
  // segments explicitly. Both our guard and the DB CHECK are PREFIX checks,
  // not containment checks, and a normalizing driver would make `..` live.
  const safe = fileName.replace(/[^\w.\-֐-׿]/g, "_").replace(/\.{2,}/g, "_").slice(-100);
  return `${groupId}/${attachmentId}/${safe}`;
}

export type PresignedUpload = {
  url: string;
  key: string;
  /** Echoed back so the caller can enforce them client-side too. */
  maxBytes: number;
  expiresInSeconds: number;
};

export interface StorageDriver {
  presignUpload(input: {
    key: string;
    contentType: string;
    maxBytes: number;
  }): Promise<PresignedUpload>;
  presignDownload(key: string, expiresInSeconds?: number): Promise<string>;
  /** Post-upload truth: never trust the client's claimed size/type. */
  head(key: string): Promise<{ sizeBytes: number; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

/**
 * Dev/test driver. Keeps blobs in memory and hands out fake URLs — enough to
 * exercise the whole flow (presign → verify → record) without a network or an
 * account. It is NOT a stand-in for production: `createStorage` refuses to
 * return it in production rather than silently "working".
 */
export function createMemoryStorage(): StorageDriver & {
  __put(key: string, sizeBytes: number, contentType: string): void;
} {
  const objects = new Map<string, { sizeBytes: number; contentType: string }>();
  return {
    __put(key, sizeBytes, contentType) {
      objects.set(key, { sizeBytes, contentType });
    },
    async presignUpload({ key, maxBytes }) {
      return {
        url: `memory://upload/${encodeURIComponent(key)}`,
        key,
        maxBytes,
        expiresInSeconds: 300,
      };
    },
    async presignDownload(key, expiresInSeconds = 300) {
      return `memory://download/${encodeURIComponent(key)}?e=${expiresInSeconds}`;
    },
    async head(key) {
      return objects.get(key) ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

export function createStorage(): StorageDriver {
  if (process.env.NODE_ENV === "production") {
    // Fail closed. A production deploy that silently used the in-memory
    // driver would accept uploads and lose every one of them.
    throw new Error(
      "no production storage driver configured — wire R2 (deploy gate, see STACK.md)",
    );
  }
  return createMemoryStorage();
}
