import { redirect } from "next/navigation";

import { completeAccept, ensureInvitedUser, previewInvitation } from "@/features/identity";
import { auth, signIn } from "@/platform/auth";
import { getPrisma } from "@/platform/db";

/**
 * הזמנה — the public accept page. URL carries groupId + raw token (?g=&t=),
 * so every lookup runs inside withGroup: RLS applies, no bypass. Anonymous:
 * offer the magic link. Authenticated: complete the join.
 */
export default async function InvitePage(props: {
  searchParams: Promise<{ g?: string; t?: string; done?: string }>;
}) {
  const { g, t, done } = await props.searchParams;
  if (done === "1") {
    return (
      <main className="signin">
        <h1>ברוכים הבאים לחבורה 🎉</h1>
        <p>ההצטרפות הושלמה. <a href="/">אל בית המדרש ←</a></p>
      </main>
    );
  }
  if (!g || !t) return <Invalid />;

  const db = getPrisma();
  const invite = await previewInvitation(db, g, t);
  if (!invite) return <Invalid />;

  const session = await auth();

  async function sendLink() {
    "use server";
    const user = await ensureInvitedUser(getPrisma(), g!, t!);
    if (!user) redirect(`/invite?g=${g}&t=${t}`);
    await signIn("email", {
      email: user.email,
      redirect: false,
      redirectTo: `/invite?g=${encodeURIComponent(g!)}&t=${encodeURIComponent(t!)}`,
    });
    redirect("/verify");
  }

  async function join() {
    "use server";
    const s = await auth();
    if (!s?.user?.id || !s.user.email) redirect(`/invite?g=${g}&t=${t}`);
    const res = await completeAccept(getPrisma(), {
      groupId: g!,
      rawToken: t!,
      userId: s.user.id,
      userEmail: s.user.email,
    });
    if (res.ok || res.reason === "already_member") redirect(`/invite?done=1`);
    redirect(`/invite?g=${g}&t=${t}`);
  }

  return (
    <main className="signin">
      <h1>הוזמנתם לבית המדרש</h1>
      <p>
        ההזמנה עבור <bdi dir="ltr">{invite.email}</bdi> בתפקיד{" "}
        <strong>{roleLabel(invite.role)}</strong>.
      </p>
      {session?.user ? (
        <form action={join}>
          <button type="submit">הצטרפות לחבורה</button>
        </form>
      ) : (
        <form action={sendLink}>
          <p>לאימות הכתובת נשלח אליכם קישור כניסה חד־פעמי.</p>
          <button type="submit">שליחת קישור כניסה</button>
        </form>
      )}
    </main>
  );
}

function Invalid() {
  return (
    <main className="signin">
      <h1>ההזמנה אינה בתוקף</h1>
      <p>הקישור פג, בוטל, או כבר נוצל. בקשו מהגבאי הזמנה חדשה.</p>
    </main>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: "מנהל/ת",
    EDITOR: "עורך/ת",
    MEMBER: "חבר/ה",
    GUEST: "אורח/ת",
  };
  return labels[role] ?? role;
}
