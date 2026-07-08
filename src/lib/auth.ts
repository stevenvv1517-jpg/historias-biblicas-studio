import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { addUserSession } from "./admin";

const adminEmail = process.env.ADMIN_EMAIL;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        await addUserSession(user.email, user.name || "Usuario");
      }
      return true;
    },
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as Record<string, unknown>;
        token.email = p.email as string;
        token.name = p.name as string;
        token.picture = p.picture as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
  },
};

export function isAdmin(email?: string | null): boolean {
  if (!email || !adminEmail) return false;
  return email === adminEmail;
}
