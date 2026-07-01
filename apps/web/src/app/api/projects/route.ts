import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { z } from "zod";

const createSchema = z.object({
  key: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, "Key must be uppercase letters/numbers"),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  jiraProjectKey: z.string().optional(),
  jiraBaseUrl: z.string().url().optional(),
  jiraApiToken: z.string().optional(),
  jiraUserEmail: z.string().email().optional(),
});

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  // If user has a tenantId, show all projects in the workspace
  if (caller.tenantId) {
    const projects = await prisma.project.findMany({
      where: { tenantId: caller.tenantId },
      include: {
        _count: { select: { testCases: true, testCycles: true, members: true } },
        members: {
          where: { userId: caller.userId },
          select: { role: true },
        },
      },
    });

    return ok(projects.map((p) => ({
      ...p,
      role: p.members[0]?.role || null,
    })));
  }

  // Fallback: show only projects user is a member of
  const memberships = await prisma.projectMember.findMany({
    where: { userId: caller.userId },
    include: {
      project: {
        include: {
          _count: { select: { testCases: true, testCycles: true, members: true } },
        },
      },
    },
  });

  return ok(memberships.map((m) => ({ ...m.project, role: m.role })));
}

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);
  if (!caller.tenantId) return err("No workspace — complete onboarding first", 403);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const existing = await prisma.project.findFirst({
    where: { tenantId: caller.tenantId, key: parsed.data.key },
  });
  if (existing) return err(`Project key "${parsed.data.key}" already exists in this workspace`, 409);

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      tenantId: caller.tenantId,
      members: {
        create: { userId: caller.userId, role: "OWNER" },
      },
      statuses: {
        create: [
          { name: "Draft", color: "#6b7280", type: "CASE", isDefault: true },
          { name: "Ready", color: "#22c55e", type: "CASE" },
          { name: "Deprecated", color: "#ef4444", type: "CASE" },
          { name: "Draft", color: "#6b7280", type: "CYCLE", isDefault: true },
          { name: "Active", color: "#3b82f6", type: "CYCLE" },
          { name: "Closed", color: "#6b7280", type: "CYCLE" },
          { name: "Not Run", color: "#6b7280", type: "EXECUTION", isDefault: true },
          { name: "Pass", color: "#22c55e", type: "EXECUTION" },
          { name: "Fail", color: "#ef4444", type: "EXECUTION" },
          { name: "Blocked", color: "#f59e0b", type: "EXECUTION" },
          { name: "Skipped", color: "#6b7280", type: "EXECUTION" },
        ],
      },
      priorities: {
        create: [
          { name: "Critical", level: 1, color: "#ef4444" },
          { name: "High", level: 2, color: "#f97316" },
          { name: "Medium", level: 3, color: "#eab308", isDefault: true },
          { name: "Low", level: 4, color: "#22c55e" },
        ],
      },
    },
  });

  return ok(project, 201);
}
