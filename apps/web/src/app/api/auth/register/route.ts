import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-helpers";
import { hash } from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  tenantMode: z.enum(["create", "join"]),
  tenantName: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return err("Invalid JSON");

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed");

    const { name, email, password, tenantMode, tenantName, tenantId } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return err("An account with this email already exists", 409);

    const passwordHash = await hash(password, 12);

    if (tenantMode === "create") {
      // Create new tenant and user as OWNER

      // Generate slug from tenant name
      const slug = tenantName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Check if slug already exists
      const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
      if (existingTenant) {
        return err("A workspace with this name already exists. Please choose a different name.", 409);
      }

      // Create tenant and user in a transaction
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: "TESTER",
          tenantMembers: {
            create: {
              tenant: {
                create: {
                  name: tenantName,
                  slug,
                },
              },
              role: "OWNER",
            },
          },
        },
        select: { id: true, name: true, email: true },
      });

      return ok(user, 201);
    } else if (tenantMode === "join") {
      // Join existing tenant by name
      // Verify tenant exists by name
      const tenant = await prisma.tenant.findFirst({
        where: { name: tenantName },
      });
      if (!tenant) {
        return err("Workspace not found. Please check the workspace name and try again.", 404);
      }

      // Create user and add to tenant as MEMBER
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: "TESTER",
          tenantMembers: {
            create: {
              tenantId: tenant.id,
              role: "MEMBER",
            },
          },
        },
        select: { id: true, name: true, email: true },
      });

      return ok(user, 201);
    }

    return err("Invalid tenant mode", 400);
  } catch (error) {
    console.error("[register] Error:", error);
    return err("Registration failed. Please try again later.", 500);
  }
}
