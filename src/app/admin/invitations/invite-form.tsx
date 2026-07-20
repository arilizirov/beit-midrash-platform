"use client";

import { useActionState } from "react";

import { createInvitationAction, type CreateResult } from "./actions";

/** The invite link renders from in-memory action state — it never enters a URL. */
export function InviteForm() {
  const [result, formAction, pending] = useActionState<CreateResult, FormData>(
    createInvitationAction,
    null,
  );

  return (
    <section aria-label="הזמנה חדשה">
      <h2>הזמנה חדשה</h2>
      {result && "url" in result ? (
        <div role="status">
          <p>
            ההזמנה נוצרה ✓ שלחו את הקישור אל <bdi dir="ltr">{result.email}</bdi> (מוצג
            פעם אחת — נשמר במערכת רק בצורה חתומה):
          </p>
          <code dir="ltr">{result.url}</code>
        </div>
      ) : null}
      {result && "error" in result ? <p role="alert">{result.error}</p> : null}
      <form action={formAction}>
        <label htmlFor="email">דוא״ל</label>
        <input id="email" name="email" type="email" required dir="ltr" />
        <label htmlFor="role">תפקיד</label>
        <select id="role" name="role" defaultValue="MEMBER">
          <option value="MEMBER">חבר/ה</option>
          <option value="EDITOR">עורך/ת</option>
          <option value="ADMIN">מנהל/ת</option>
          <option value="GUEST">אורח/ת</option>
        </select>
        <button type="submit" disabled={pending}>
          {pending ? "יוצר…" : "יצירת הזמנה"}
        </button>
      </form>
    </section>
  );
}
