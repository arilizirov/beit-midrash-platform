import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createInvitation,
  listPendingInvitations,
  requireMembership,
  revokeInvitation,
  type Role,
} from "@/features/identity";
import { getPrisma } from "@/platform/db";

/**
 * הזמנות — admin screen (layer 2: requireMembership + can()). Email sending
 * is a deploy-gate, so the invite LINK is shown once for the admin to share
 * (the link itself is the secret — that is the product design, SPEC §6).
 */
export default async function InvitationsAdminPage(props: {
  searchParams: Promise<{ link?: string; e?: string }>;
}) {
  const { group } = await requireMembership("invitation.create");
  const { link, e } = await props.searchParams;
  const pending = await listPendingInvitations(getPrisma(), group.id);

  async function create(formData: FormData) {
    "use server";
    const { user, group, membership } = await requireMembership("invitation.create");
    void membership;
    const email = String(formData.get("email") ?? "").trim();
    const role = String(formData.get("role") ?? "MEMBER") as Role;
    if (!email) return;
    const { rawToken } = await createInvitation(getPrisma(), {
      groupId: group.id,
      email,
      role,
      invitedById: user.id,
    });
    const url = `/invite?g=${encodeURIComponent(group.id)}&t=${encodeURIComponent(rawToken)}`;
    redirect(`/admin/invitations?link=${encodeURIComponent(url)}&e=${encodeURIComponent(email)}`);
  }

  async function revoke(formData: FormData) {
    "use server";
    const { group } = await requireMembership("invitation.revoke");
    const id = String(formData.get("id") ?? "");
    if (id) await revokeInvitation(getPrisma(), group.id, id);
    revalidatePath("/admin/invitations");
  }

  return (
    <main className="admin">
      <h1>הזמנות · {group.name}</h1>

      {link ? (
        <section aria-label="קישור הזמנה">
          <h2>ההזמנה נוצרה ✓</h2>
          <p>
            שלחו את הקישור אל <bdi dir="ltr">{e}</bdi> (מוצג פעם אחת — נשמר במערכת רק
            בצורה חתומה):
          </p>
          <code dir="ltr">{link}</code>
        </section>
      ) : null}

      <section aria-label="הזמנה חדשה">
        <h2>הזמנה חדשה</h2>
        <form action={create}>
          <label htmlFor="email">דוא״ל</label>
          <input id="email" name="email" type="email" required dir="ltr" />
          <label htmlFor="role">תפקיד</label>
          <select id="role" name="role" defaultValue="MEMBER">
            <option value="MEMBER">חבר/ה</option>
            <option value="EDITOR">עורך/ת</option>
            <option value="ADMIN">מנהל/ת</option>
            <option value="GUEST">אורח/ת</option>
          </select>
          <button type="submit">יצירת הזמנה</button>
        </form>
      </section>

      <section aria-label="הזמנות ממתינות">
        <h2>ממתינות ({pending.length})</h2>
        {pending.length === 0 ? (
          <p>אין הזמנות ממתינות.</p>
        ) : (
          <ul>
            {pending.map((inv) => (
              <li key={inv.id}>
                <bdi dir="ltr">{inv.email}</bdi> · {inv.role} · בתוקף עד{" "}
                {inv.expiresAt.toLocaleDateString("he-IL")}
                <form action={revoke} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={inv.id} />
                  <button type="submit">ביטול</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
