import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { z } from "zod";
import { createJiraBug, getJiraIssue } from "@/lib/jira";

const linkSchema = z.object({
  jiraIssueKey: z.string(),
});

const createSchema = z.object({
  projectId: z.string(),
  jiraProjectKey: z.string(),
  summary: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string; execId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  // Verify access to the test cycle's project
  const testCycle = await prisma.testCycle.findUnique({
    where: { id: params.id },
    select: { projectId: true },
  });

  if (!testCycle) return err("Not found", 404);

  const access = await verifyProjectAccess(caller.userId, testCycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const defects = await prisma.defectLink.findMany({
    where: { executionId: params.execId },
  });

  return ok(defects);
}

export async function POST(req: NextRequest, { params }: { params: { id: string; execId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  // Verify access to the test cycle's project
  const testCycle = await prisma.testCycle.findUnique({
    where: { id: params.id },
    select: { projectId: true },
  });

  if (!testCycle) return err("Not found", 404);

  const access = await verifyProjectAccess(caller.userId, testCycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid JSON");

  if (action === "create") {
    // Create a new JIRA bug and link it
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.message);

    const bug = await createJiraBug(parsed.data.projectId, {
      jiraProjectKey: parsed.data.jiraProjectKey,
      summary: parsed.data.summary,
      description: parsed.data.description ?? "",
    });
    if (!bug) return err("Failed to create JIRA issue. Check JIRA configuration.", 502);

    const defect = await prisma.defectLink.create({
      data: {
        jiraIssueKey: bug.key,
        jiraSummary: parsed.data.summary,
        jiraUrl: bug.url,
        executionId: params.execId,
      },
    });
    return ok(defect, 201);
  }

  // Link an existing JIRA issue
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  // Fetch the issue from JIRA to get summary/status
  const execution = await prisma.testCaseExecution.findUnique({
    where: { id: params.execId },
    include: { testCaseVersion: { include: { testCase: { select: { projectId: true } } } } },
  });

  if (!execution || !execution.testCaseVersion) {
    return err("Cannot add defect to external execution or non-existent execution", 400);
  }

  const projectId = execution.testCaseVersion.testCase.projectId;
  const issue = await getJiraIssue(projectId, parsed.data.jiraIssueKey);

  const defect = await prisma.defectLink.create({
    data: {
      jiraIssueKey: parsed.data.jiraIssueKey,
      jiraSummary: issue?.fields.summary ?? null,
      jiraStatus: issue?.fields.status.name ?? null,
      executionId: params.execId,
    },
  });

  return ok(defect, 201);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string; execId: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  // Verify access to the test cycle's project
  const testCycle = await prisma.testCycle.findUnique({
    where: { id: params.id },
    select: { projectId: true },
  });

  if (!testCycle) return err("Not found", 404);

  const access = await verifyProjectAccess(caller.userId, testCycle.projectId, caller.tenantId);
  if (!access) return err("Not found", 404);

  const { searchParams } = new URL(req.url);
  const defectId = searchParams.get("defectId");
  if (!defectId) return err("defectId is required");

  await prisma.defectLink.delete({ where: { id: defectId, executionId: params.execId } });
  return ok({ deleted: true });
}
