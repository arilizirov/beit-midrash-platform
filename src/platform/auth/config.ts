/**
 * Auth.js (NextAuth v5) — self-hosted, invite-only, magic-link primary
 * (SPEC §2/§6). Database sessions via the Prisma adapter.
 *
 * No nodemailer: it carries unfixed high-severity advisories (SMTP/CRLF
 * injection — npm audit blocks it) and V1 doesn't need SMTP yet. The
 * provider below console-logs the link in dev and REFUSES to run in
 * production until a real sender is wired (deploy-gate; owner decision:
 * Resend-style API vs SMTP relay — see STACK.md).
 */
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import { getBasePrisma, getPrisma } from "../db";
import { canSignIn } from "./policy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter's PrismaClient type predates driver adapters; our client is
  // structurally compatible (same delegates the adapter calls). Narrow cast —
  // `as never` would blind tsc to future adapter-contract changes.
  // BASE (unfiltered) client on purpose: the adapter's lookups are its own
  // contract — a filtered client would turn a soft-deleted user's sign-in
  // into createUser → P2002 500 if it ever swapped findUnique for findFirst.
  adapter: PrismaAdapter(getBasePrisma() as unknown as Parameters<typeof PrismaAdapter>[0]),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/verify", error: "/signin" },
  providers: [
    {
      id: "email",
      type: "email",
      name: "דוא״ל",
      from: process.env.EMAIL_FROM ?? "beit-midrash@localhost",
      maxAge: 24 * 60 * 60,
      options: {},
      async sendVerificationRequest({ identifier, url }) {
        if (process.env.NODE_ENV === "production") {
          // Fail closed: no silent no-op that looks like a sent email.
          throw new Error("Email delivery is not configured (deploy gate — see STACK.md)");
        }
        console.log(`[dev magic-link] ${identifier} → ${url}`);
      },
    },
  ],
  callbacks: {
    async signIn({ user }) {
      // Invite-only: the accept flow creates the User row first; unknown
      // emails never get a link. findUnique (email is @unique) is the
      // documented UNFILTERED path — a soft-deleted row must be SEEN here so
      // canSignIn rejects it, not filtered away to a null meaning "unknown".
      const email = user.email;
      if (!email) return false;
      const existing = await getPrisma().user.findUnique({
        where: { email },
        select: { status: true, deletedAt: true },
      });
      return canSignIn(existing);
    },
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
