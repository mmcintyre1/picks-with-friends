import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { verifyPin, MAX_FAILED_ATTEMPTS, LOCKOUT_MS } from "@/lib/pin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: {},
        pin: {},
      },
      async authorize(credentials) {
        const { username, pin } = credentials ?? {};
        if (typeof username !== "string" || typeof pin !== "string") return null;

        // A member is seeded with a username and no PIN yet; they can only
        // authenticate this way once they've claimed one via the claim flow.
        const user = await prisma.user.findUnique({ where: { username } });
        if (!user?.pinHash) return null;

        // Lockout is enforced here regardless of what the submitted PIN is --
        // this is the actual security boundary; the login form's own pre-check
        // is only there to show a friendlier message before hitting this.
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const valid = await verifyPin(pin, user.pinHash);

        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const lockedOut = attempts >= MAX_FAILED_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: lockedOut ? 0 : attempts,
              lockedUntil: lockedOut ? new Date(Date.now() + LOCKOUT_MS) : null,
            },
          });
          return null;
        }

        if (user.failedLoginAttempts > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return { id: user.id, name: user.name, username: user.username };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.username = token.username;
      return session;
    },
  },
});
