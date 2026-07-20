/**
 * Request guards — enforcement layer 2 (SPEC §6). Every server action and
 * protected page goes through these; middleware (layer 1) is only a coarse
 * cookie gate. All fail closed by redirecting to /signin.
 */
import { redirect } from "next/navigation";

import { auth, canSignIn } from "../../platform/auth";
import { getPrisma } from "../../platform/db";
import { withGroup } from "../../platform/tenancy";

import { can, type Capability } from "./model";

/**
 * Session + per-request user re-check: this is where suspending or
 * soft-deleting a user revokes their LIVE sessions (Session rows cascade
 * only on hard delete — canSignIn doubles as the continuation rule).
 */
export async function requireUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/signin");
  const user = await getPrisma().user.findFirst({
    where: { id },
    select: { id: true, email: true, status: true, deletedAt: true },
  });
  if (!canSignIn(user)) redirect("/signin");
  return user!;
}

/** V1 invariant: exactly one Group (SPEC §4). Multi-group resolves from URL later. */
export async function currentGroup() {
  const group = await getPrisma().group.findFirst({
    where: { deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  if (!group) throw new Error("no Group seeded — run `npm run db:seed`");
  return group;
}

/**
 * Layer-2 core: active membership in the current group, optionally holding a
 * capability. Non-members and missing capabilities land back at /signin —
 * indistinguishable from not being logged in (no resource enumeration).
 */
export async function requireMembership(capability?: Capability) {
  const user = await requireUser();
  const group = await currentGroup();
  const membership = await withGroup(getPrisma(), group.id, (tx) =>
    tx.membership.findFirst({
      where: { userId: user.id, status: "ACTIVE", deletedAt: null },
      select: { id: true, role: true },
    }),
  );
  if (!membership) redirect("/signin");
  if (capability && !can(membership.role, capability)) redirect("/");
  return { user, group, membership };
}
