import { listPendingInvitations, requireMembership } from "@/features/identity";
import { getPrisma } from "@/platform/db";

import { revokeInvitationAction } from "./actions";
import { InviteForm } from "./invite-form";

/**
 * הזמנות — admin screen (layer 2: requireMembership + can()). Email sending
 * is a deploy-gate, so the invite LINK is shown once for the admin to share.
 * The link renders from action state, never from a URL parameter — the raw
 * token is a bearer secret (see actions.ts).
 */
export default async function InvitationsAdminPage() {
  const { group } = await requireMembership("invitation.create");
  const pending = await listPendingInvitations(getPrisma(), group.id);
  const now = Date.now();

  return (
    <main className="admin">
      <h1>הזמנות · {group.name}</h1>

      <InviteForm />

      <section aria-label="הזמנות ממתינות">
        <h2>ממתינות ({pending.length})</h2>
        {pending.length === 0 ? (
          <p>אין הזמנות ממתינות.</p>
        ) : (
          <ul>
            {pending.map((inv) => (
              <li key={inv.id}>
                <bdi dir="ltr">{inv.email}</bdi> · {inv.role} ·{" "}
                {inv.expiresAt.getTime() < now ? (
                  <strong>פג תוקף — יש לבטל וליצור חדשה</strong>
                ) : (
                  <>בתוקף עד {inv.expiresAt.toLocaleDateString("he-IL")}</>
                )}
                <form action={revokeInvitationAction} style={{ display: "inline" }}>
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
