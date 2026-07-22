// Use-cases for sources (SPEC §4, §9). Orchestrates the pure ref normalizer +
// platform; no framework leakage. AUTHZ IS THE CALLER'S JOB — a server action
// gates on requireMembership + can() (Add Source/Citation needs ≥ MEMBER;
// edit/delete is Own-only for a member, SPEC §6).
import type { PrismaClient } from "../../platform/db";
import { logActivity } from "../../platform/telemetry";
import { withGroup } from "../../platform/tenancy";
import { newId } from "../../shared_kernel";

import { normalizeRef } from "./ref";
import type { CitationEntityType, SourceResult } from "./types";

export type { CitationEntityType, SourceResult } from "./types";
export { normalizeRef } from "./ref";

/**
 * Turn a raw ref into a Source, reusing the existing row when one is already
 * there (SPEC §4: "citations reuse one row per ref"). No raw free-text ref is
 * ever stored — everything goes through the normalizer first, and a bad ref
 * comes back as a typed RefError for a field-level form message, not a throw.
 *
 * Find-then-create races on the partial unique: two callers can both miss the
 * row and both try to insert. A P2002 aborts its transaction (Postgres poisons
 * a transaction on a failed statement), so the loser cannot recover inside it —
 * instead the whole attempt is retried ONCE, and the retry's findFirst returns
 * the row the winner just committed. No error surfaces for the ordinary "two
 * people cited the same daf at once" case.
 */
export async function findOrCreateSource(
  db: PrismaClient,
  input: { groupId: string; createdById: string; raw: string },
): Promise<SourceResult> {
  const normalized = normalizeRef(input.raw);
  if (!normalized.ok) return { ok: false, error: normalized.error };
  const { normalizedRef, hebrewRef, structured } = normalized.value;

  const attempt = (): Promise<SourceResult> =>
    withGroup(db, input.groupId, async (tx) => {
      const existing = await tx.source.findFirst({ where: { ref: normalizedRef } });
      if (existing) return { ok: true, source: existing };

      const id = newId();
      const source = await tx.source.create({
        data: {
          id,
          groupId: input.groupId,
          workTitle: structured.work,
          workCategory: structured.category,
          ref: normalizedRef,
          refStructured: structured,
          hebrewRef,
          createdById: input.createdById,
        },
      });
      await logActivity(tx, {
        groupId: input.groupId,
        action: "source.create",
        entityType: "SOURCE",
        entityId: id,
        actorId: input.createdById,
        metadata: { ref: normalizedRef, workCategory: structured.category },
      });
      return { ok: true, source };
    });

  try {
    return await attempt();
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      // The concurrent winner's row now exists; the retry finds and returns it.
      return attempt();
    }
    throw error;
  }
}

/**
 * Attach a source to a piece of content. entityType/entityId are a polymorphic
 * pointer with no DB FK (the polymorphism rule) — the composite FK on
 * (sourceId, groupId) is what guarantees the source is in this tenant.
 */
export async function addCitation(
  db: PrismaClient,
  input: {
    groupId: string;
    createdById: string;
    sourceId: string;
    entityType: CitationEntityType;
    entityId: string;
    selectionText?: string;
    selectionRange?: object;
    note?: string;
  },
) {
  const id = newId();
  return withGroup(db, input.groupId, async (tx) => {
    const citation = await tx.sourceCitation.create({
      data: {
        id,
        groupId: input.groupId,
        sourceId: input.sourceId,
        entityType: input.entityType,
        entityId: input.entityId,
        selectionText: input.selectionText,
        selectionRange: input.selectionRange,
        note: input.note,
        createdById: input.createdById,
      },
    });
    await logActivity(tx, {
      groupId: input.groupId,
      action: "citation.create",
      entityType: "SOURCE_CITATION",
      entityId: id,
      actorId: input.createdById,
      metadata: { sourceId: input.sourceId, on: input.entityType },
    });
    return citation;
  });
}

/** Every citation OF a source (e.g. "where has this daf been cited?"). */
export function listCitationsForSource(db: PrismaClient, groupId: string, sourceId: string) {
  return withGroup(db, groupId, (tx) =>
    tx.sourceCitation.findMany({
      where: { sourceId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, entityType: true, entityId: true, note: true, createdById: true, createdAt: true },
    }),
  );
}

/** Every citation ON a piece of content (e.g. the sources of a discussion). */
export function listCitationsForEntity(
  db: PrismaClient,
  groupId: string,
  entityType: CitationEntityType,
  entityId: string,
) {
  return withGroup(db, groupId, (tx) =>
    tx.sourceCitation.findMany({
      where: { entityType, entityId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, sourceId: true, selectionText: true, note: true, createdById: true, createdAt: true },
    }),
  );
}
