import { prisma } from "./prisma";

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    assignee?: { displayName: string; emailAddress: string };
    priority?: { name: string };
  };
}

interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
}

async function getJiraAuth(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { jiraBaseUrl: true, jiraApiToken: true, jiraUserEmail: true },
  });
  if (!project?.jiraBaseUrl || !project.jiraApiToken || !project.jiraUserEmail) {
    return null;
  }
  return project;
}

function makeHeaders(email: string, token: string) {
  const creds = Buffer.from(`${email}:${token}`).toString("base64");
  return {
    Authorization: `Basic ${creds}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function searchJiraIssues(
  projectId: string,
  query: string,
  type: "bug" | "all" = "all"
): Promise<JiraIssue[]> {
  const auth = await getJiraAuth(projectId);
  if (!auth) return [];

  const jqlParts = [`text ~ "${query}"`];
  if (type === "bug") jqlParts.push('issuetype = Bug');

  const jql = jqlParts.join(" AND ") + " ORDER BY updated DESC";
  const url = `${auth.jiraBaseUrl}/rest/api/3/issue/picker?currentJQL=${encodeURIComponent(jql)}&query=${encodeURIComponent(query)}&limit=20`;

  try {
    const resp = await fetch(url, { headers: makeHeaders(auth.jiraUserEmail!, auth.jiraApiToken!) });
    if (!resp.ok) return [];
    const data = await resp.json();
    // Jira issue picker returns sections
    const sections = data.sections ?? [];
    return sections.flatMap((s: { issues: JiraIssue[] }) => s.issues ?? []);
  } catch {
    return [];
  }
}

export async function getJiraIssue(projectId: string, issueKey: string): Promise<JiraIssue | null> {
  const auth = await getJiraAuth(projectId);
  if (!auth) return null;

  try {
    const url = `${auth.jiraBaseUrl}/rest/api/3/issue/${issueKey}?fields=summary,status,issuetype,assignee,priority`;
    const resp = await fetch(url, { headers: makeHeaders(auth.jiraUserEmail!, auth.jiraApiToken!) });
    if (!resp.ok) return null;
    return resp.json();
  } catch {
    return null;
  }
}

export async function createJiraBug(
  projectId: string,
  {
    jiraProjectKey,
    summary,
    description,
  }: { jiraProjectKey: string; summary: string; description: string }
): Promise<{ key: string; url: string } | null> {
  const auth = await getJiraAuth(projectId);
  if (!auth) return null;

  try {
    const url = `${auth.jiraBaseUrl}/rest/api/3/issue`;
    const body = {
      fields: {
        project: { key: jiraProjectKey },
        summary,
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
        },
        issuetype: { name: "Bug" },
      },
    };
    const resp = await fetch(url, {
      method: "POST",
      headers: makeHeaders(auth.jiraUserEmail!, auth.jiraApiToken!),
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return { key: data.key, url: `${auth.jiraBaseUrl}/browse/${data.key}` };
  } catch {
    return null;
  }
}
