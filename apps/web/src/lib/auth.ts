import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import { compare } from "bcryptjs";
import { z } from "zod";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: string;
      tenantId: string | null;
      tenantRole: string | null;
      tenantName: string | null;
      tenantLogoUrl: string | null;
      tenantLogoDisplay: string | null;
    };
  }
  interface User {
    role?: string;
  }
}


const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.password) return null;

        const valid = await compare(parsed.data.password, user.password);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        // Load first tenant membership on sign-in
        const membership = await prisma.tenantMember.findFirst({
          where: { userId: user.id as string },
          orderBy: { joinedAt: "asc" },
          include: { tenant: { select: { id: true, name: true, logoUrl: true, logoDisplay: true } } },
        });
        token.tenantId = membership?.tenantId ?? null;
        token.tenantRole = membership?.role ?? null;
        token.tenantName = membership?.tenant?.name ?? null;
        token.tenantLogoUrl = membership?.tenant?.logoUrl ?? null;
        token.tenantLogoDisplay = membership?.tenant?.logoDisplay ?? null;
      }

      // Tenant switch: client calls useSession().update({ tenantId })
      if (trigger === "update" && session?.tenantId) {
        const membership = await prisma.tenantMember.findUnique({
          where: { tenantId_userId: { tenantId: session.tenantId, userId: token.id as string } },
          include: { tenant: { select: { id: true, name: true, logoUrl: true, logoDisplay: true } } },
        });
        if (membership) {
          token.tenantId = membership.tenantId;
          token.tenantRole = membership.role;
          token.tenantName = membership.tenant?.name ?? null;
          token.tenantLogoUrl = membership.tenant?.logoUrl ?? null;
          token.tenantLogoDisplay = membership.tenant?.logoDisplay ?? null;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.tenantId = (token.tenantId as string | null | undefined) ?? null;
        session.user.tenantRole = (token.tenantRole as string | null | undefined) ?? null;
        session.user.tenantName = (token.tenantName as string | null | undefined) ?? null;
        session.user.tenantLogoUrl = (token.tenantLogoUrl as string | null | undefined) ?? null;
        session.user.tenantLogoDisplay = (token.tenantLogoDisplay as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
