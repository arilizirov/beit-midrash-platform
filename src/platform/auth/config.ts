/**
 * Auth.js (NextAuth v5) — self-hosted, invite-only, magic-link primary
 * (SPEC §2/§6). Database sessions via the Prisma adapter.
 */
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";

import { getPrisma } from "../db";
import { canSignIn } from "./policy";

const emailServer = process.env.EMAIL_SERVER;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // The adapter's PrismaClient type predates driver adapters; our client is
  // structurally compatible (same delegates the adapter calls).
  adapter: PrismaAdapter(getPrisma() as never),
  session: { strategy: "database" },
  pages: { signIn: "/signin", verifyRequest: "/verify", error: "/signin" },
  providers: [
    Nodemailer({
      server: emailServer ?? { jsonTransport: true },
      from: process.env.EMAIL_FROM ?? "beit-midrash@localhost",
      ...(emailServer
        ? {}
        : {
            // Dev fallback (no EMAIL_SERVER): print the magic link instead of
            // sending. Refuses to run in production — fail closed, not open.
            sendVerificationRequest: async ({ identifier, url }) => {
              if (process.env.NODE_ENV === "production") {
                throw new Error("EMAIL_SERVER is required in production");
              }
              console.log(`[dev magic-link] ${identifier} → ${url}`);
            },
          }),
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // Invite-only: the accept flow creates the User row first; unknown
      // emails never get a link. findFirst on purpose — a soft-deleted row
      // must be SEEN and rejected, not filtered away silently.
      const email = user.email;
      if (!email) return false;
      const existing = await getPrisma().user.findFirst({
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
