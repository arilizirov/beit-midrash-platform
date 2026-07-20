import { redirect } from "next/navigation";

import { signIn } from "@/platform/auth";

/**
 * כניסה — magic-link sign-in. Invite-only: unknown emails get the same
 * "check your inbox" screen (no account enumeration), they just never
 * receive a link.
 */
export default async function SignInPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await props.searchParams;

  async function sendLink(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) return;
    try {
      await signIn("nodemailer", { email, redirect: false });
    } catch {
      // AccessDenied etc. — swallowed on purpose: same UX for every input.
    }
    redirect("/verify");
  }

  return (
    <main className="signin">
      <h1>בית המדרש הדיגיטלי</h1>
      <p>הכניסה לחברי החבורה בלבד. הזינו את כתובת הדוא״ל שאליה הוזמנתם:</p>
      {error ? <p role="alert">הקישור לא אושר. ודאו שנכנסתם מהכתובת שהוזמנה, או בקשו הזמנה חדשה.</p> : null}
      <form action={sendLink}>
        <label htmlFor="email">דוא״ל</label>
        <input id="email" name="email" type="email" required dir="ltr" autoComplete="email" />
        <button type="submit">שליחת קישור כניסה</button>
      </form>
    </main>
  );
}
