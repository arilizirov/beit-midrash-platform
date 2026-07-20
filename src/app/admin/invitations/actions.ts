"use server";

import { revalidatePath } from "next/cache";

import {
  createInvitation,
  requireMembership,
  revokeInvitation,
  type Role,
} from "@/features/identity";
import { getPrisma } from "@/platform/db";

export type CreateResult = { url: string; email: string } | { error: string } | null;

/**
 * Returns the invite link via action state — NEVER via redirect query string:
 * the raw token is a bearer secret, and a URL puts it in browser history,
 * server logs, and Referer headers (debt-hawk, F2c-2).
 */
export async function createInvitationAction(
  _prev: CreateResult,
  formData: FormData,
): Promise<CreateResult> {
  const { user, group } = await requireMembership("invitation.create");
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "MEMBER") as Role;
  if (!email) return { error: "נדרשת כתובת דוא״ל" };
  const { rawToken, invitation } = await createInvitation(getPrisma(), {
    groupId: group.id,
    email,
    role,
    invitedById: user.id,
  });
  revalidatePath("/admin/invitations");
  return {
    url: `/invite?g=${encodeURIComponent(group.id)}&t=${encodeURIComponent(rawToken)}`,
    email: invitation.email,
  };
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const { group } = await requireMembership("invitation.revoke");
  const id = String(formData.get("id") ?? "");
  if (id) await revokeInvitation(getPrisma(), group.id, id);
  revalidatePath("/admin/invitations");
}
