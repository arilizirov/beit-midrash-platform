/**
 * Request guards — enforcement layer 2 (SPEC §6). Every server action and
 * protected page goes through these; middleware (layer 1) is only a coarse
 * cookie gate. All fail closed by redirecting to /signin.
 */
import { redirect } from "next/navigation";

import { canSignIn, seedGroupSlug } from "../../shared_kernel";

import { auth } from "../../platform/auth";
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

/**
 * V1 invariant: exactly one Group (SPEC §4); multi-group resolves from the
 * URL later (`/g/[group]`). Resolved by the SEEDED SLUG, not `findFirst` —
 * an unordered findFirst returns an arbitrary row the moment a second group
 * exists (caught by a flaky guard test, F3b), which would silently point the
 * whole app at the wrong tenant. The slug is read at call time from ONE
 * shared definition, so the seed job and the runtime cannot disagree; if
 * they somehow do, the error below says exactly that rather than sending the
 * operator off to re-seed a database that is already fine.
 */
export async function currentGroup() {
  const slug = seedGroupSlug();
  const db = getPrisma();
  const group = await db.group.findFirst({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (group) return group;

  const others = await db.group.findMany({ select: { slug: true }, take: 5 });
  if (others.length > 0) {
    throw new Error(
      `no Group with slug "${slug}", but ${others.length} group(s) exist ` +
        `(${others.map((o) => o.slug).join(", ")}). SEED_GROUP_SLUG disagrees ` +
        `with the seeded data — fix the env, do NOT re-seed.`,
    );
  }
  throw new Error(`no Group with slug "${slug}" — run \`npm run db:seed\``);
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
