import { NextRequest } from "next/server";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

function makeHeaders(email: string, token: string) {
  const creds = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${creds}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const q = searchParams.get("q") ?? "";

  if (!projectId) return err("projectId is required");
  if (!q) return ok([]);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jiraBaseUrl: true, jiraApiToken: true, jiraUserEmail: true, jiraProjectKey: true },
  });

  if (!project?.jiraBaseUrl || !project.jiraApiToken || !project.jiraUserEmail || !project.jiraProjectKey) {
    return err("JIRA not configured for this project", 400);
  }

  const jql = `project = "${project.jiraProjectKey}" AND issuetype in (Story, Epic) AND text ~ "${q}*" ORDER BY updated DESC`;
  const url = `${project.jiraBaseUrl}/rest/api/3/issue/search?jql=${encodeURIComponent(jql)}&maxResults=20&fields=summary,status,issuetype,assignee,priority`;

  try {
    const resp = await fetch(url, {
      headers: makeHeaders(project.jiraUserEmail!, project.jiraApiToken!),
    });
    if (!resp.ok) return ok([]);
    const data = await resp.json();
    return ok(data.issues ?? []);
  } catch {
    return ok([]);
  }
}
