import { NextRequest } from "next/server";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { createJiraBug } from "@/lib/jira";
import { z } from "zod";

const createBugSchema = z.object({
  projectId: z.string(),
  summary: z.string().min(1),
  description: z.string().optional(),
  jiraProjectKey: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  const parsed = createBugSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);
  const d = parsed.data;

  const access = await verifyProjectAccess(caller.userId, d.projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  const result = await createJiraBug(d.projectId, {
    jiraProjectKey: d.jiraProjectKey,
    summary: d.summary,
    description: d.description ?? "",
  });

  if (!result) return err("JIRA error: failed to create bug", 502);

  return ok({ key: result.key, url: result.url }, 201);
}
