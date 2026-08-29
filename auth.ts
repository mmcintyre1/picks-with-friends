import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { verifyPin, MAX_FAILED_ATTEMPTS, LOCKOUT_MS } from "@/lib/pin";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js only auto-trusts the request Host header on Vercel; anywhere else (Netlify
  // included) it must be told explicitly, or every request fails with a generic
  // "server configuration" error regardless of how correct the rest of the config is.
  trustHost: true,
  // Auth.js's default is a 30-day sliding window (session.updateAge, also 30 days by
  // default) -- fine for most apps, but logging back in every month is real friction for
  // a friend-group app people dip into a few times a week. A year is "basically forever"
  // for how this actually gets used, while still being a real boundary rather than no
  // expiry at all. updateAge stays short (1 day) so the sliding refresh happens on
  // essentially every visit, not just once a month.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 365, updateAge: 60 * 60 * 24 },
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
      // JWT sessions bake in whatever `name` was at login time and never refresh it on
      // their own -- without this lookup, renaming someone in /admin only takes effect
      // for that person the next time they actually log back in, which reads as "the
      // rename didn't work" everywhere their session's name is shown (NavBar, "Hey X").
      const current = await prisma.user.findUnique({
        where: { id: token.id },
        select: { name: true },
      });
      session.user.name = current?.name ?? null;
      return session;
    },
  },
});
