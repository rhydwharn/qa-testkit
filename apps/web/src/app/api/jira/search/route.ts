import { NextRequest } from "next/server";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { searchJiraIssues } from "@/lib/jira";

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const q = searchParams.get("q") ?? "";
  const type = (searchParams.get("type") ?? "all") as "bug" | "all";

  if (!projectId) return err("projectId is required");
  if (!q) return ok([]);

  const issues = await searchJiraIssues(projectId, q, type);
  return ok(issues);
}
