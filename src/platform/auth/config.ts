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

import { getPrisma } from "../db";
import { canSignIn } from "./policy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter's PrismaClient type predates driver adapters; our client is
  // structurally compatible (same delegates the adapter calls). Narrow cast —
  // `as never` would blind tsc to future adapter-contract changes.
  adapter: PrismaAdapter(getPrisma() as unknown as Parameters<typeof PrismaAdapter>[0]),
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
      // emails never get a link. findFirst on purpose — a soft-deleted row
      // must be SEEN and rejected, not filtered away silently.
      const email = user.email;
      if (!email) return false;
      const existing = await getPrisma().user.findFirst({
        // deletedAt:{} = layer-3 escape hatch: a soft-deleted row must be
        // SEEN here so canSignIn rejects it (not silently filtered to null —
        // same verdict, but the intent stays explicit).
        where: { email, deletedAt: {} },
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
