import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { hash } from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid JSON");

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return err("An account with this email already exists", 409);

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, password: passwordHash, role: "TESTER" },
      select: { id: true, name: true, email: true },
    });

    return ok(user, 201);
  } catch (error) {
    console.error("[register] Error:", error);
    return err(error instanceof Error ? error.message : "Registration failed", 500);
  }
}
