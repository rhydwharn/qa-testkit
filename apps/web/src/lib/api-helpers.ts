import { NextRequest, NextResponse } from "next/server";
import { auth } from "./auth";
import { prisma } from "./prisma";
import { hashApiKey } from "./api-key";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAuth(req: NextRequest) {
  // Check session cookie first
  const session = await auth();
  console.log("[requireAuth] Session check result:", session ? `User ${session.user?.id}` : "No session");
  if (session?.user?.id) {
    return {
      userId: session.user.id,
      tenantId: session.user.tenantId ?? null,
      projectId: null,
    };
  }

  // Fall back to API key
  const apiKey = req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!apiKey) return null;

  const hash = hashApiKey(apiKey);
  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: { userId: true, tenantId: true, projectId: true, expiresAt: true },
  });
  if (!key) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  await prisma.apiKey.update({ where: { keyHash: hash }, data: { lastUsedAt: new Date() } });
  return { userId: key.userId, tenantId: key.tenantId ?? null, projectId: key.projectId };
}

/** Like requireAuth but also enforces that a tenantId is present.
 *  Optionally verifies that a given projectId belongs to the caller's tenant. */
export async function requireTenantAccess(req: NextRequest, projectId?: string) {
  const caller = await requireAuth(req);
  if (!caller) return { error: err("Unauthorized", 401) as NextResponse, caller: null };
  if (!caller.tenantId) return { error: err("No workspace — complete onboarding first", 403) as NextResponse, caller: null };

  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { tenantId: true } });
    if (!project || project.tenantId !== caller.tenantId) {
      return { error: err("Project not found", 404) as NextResponse, caller: null };
    }
  }

  return { error: null, caller: caller as { userId: string; tenantId: string; projectId: string | null } };
}

/** Returns true if userId is a member of projectId AND (if tenantId given) the project belongs to that tenant. */
export async function verifyProjectAccess(
  userId: string,
  projectId: string,
  tenantId: string | null
): Promise<boolean> {
  const [member, project] = await Promise.all([
    prisma.projectMember.findFirst({ where: { userId, projectId }, select: { id: true } }),
    tenantId
      ? prisma.project.findUnique({ where: { id: projectId }, select: { tenantId: true } })
      : Promise.resolve(null),
  ]);
  if (!member) return false;
  if (tenantId && (!project || project.tenantId !== tenantId)) return false;
  return true;
}

export async function getProjectKey(projectId: string) {
  const count = await prisma.testCase.count({ where: { projectId } });
  return count + 1;
}
