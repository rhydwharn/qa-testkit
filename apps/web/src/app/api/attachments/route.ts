import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyProjectAccess, ok, err } from "@/lib/api-helpers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const formData = await req.formData().catch(() => null);
  if (!formData) return err("Invalid form data");

  const file = formData.get("file") as File | null;
  const executionId = formData.get("executionId") as string | null;
  const stepExecutionId = formData.get("stepExecutionId") as string | null;

  if (!file) return err("No file provided");
  if (!executionId && !stepExecutionId) return err("executionId or stepExecutionId required");

  // Verify user has access to the project containing this execution
  let projectId: string | null = null;
  if (executionId) {
    const execution = await prisma.testCaseExecution.findUnique({
      where: { id: executionId },
      select: { testCaseVersion: { select: { testCase: { select: { projectId: true } } } } }
    });
    projectId = execution?.testCaseVersion?.testCase?.projectId ?? null;
  } else if (stepExecutionId) {
    const stepExecution = await prisma.stepExecution.findUnique({
      where: { id: stepExecutionId },
      select: { execution: { select: { testCaseVersion: { select: { testCase: { select: { projectId: true } } } } } } }
    });
    projectId = stepExecution?.execution?.testCaseVersion?.testCase?.projectId ?? null;
  }

  if (!projectId) return err("Execution not found", 404);

  const access = await verifyProjectAccess(caller.userId, projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  // Limit file size to 20MB
  if (file.size > 20 * 1024 * 1024) return err("File size limit is 20MB");

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const ext = file.name.split(".").pop() ?? "bin";
  const uniqueName = `${randomUUID()}.${ext}`;
  const storageKey = `uploads/${uniqueName}`;
  const fullPath = path.join(UPLOAD_DIR, uniqueName);

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(fullPath, buffer);

  const attachment = await prisma.attachment.create({
    data: {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      storageKey,
      executionId: executionId ?? undefined,
      stepExecutionId: stepExecutionId ?? undefined,
      createdById: caller.userId,
    },
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  return ok(attachment, 201);
}

export async function GET(req: NextRequest) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const executionId = searchParams.get("executionId");
  const projectId = searchParams.get("projectId");

  // Verify project access
  if (!projectId) return err("projectId is required");
  const access = await verifyProjectAccess(caller.userId, projectId, caller.tenantId);
  if (!access) return err("Forbidden", 403);

  // Support both old style (executionId) and new style (entityType + entityId)
  if (executionId && !entityType && !entityId) {
    const attachments = await prisma.attachment.findMany({
      where: { executionId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return ok(attachments);
  }

  if (!entityType || !entityId) {
    return err("entityType and entityId required");
  }

  const where: Record<string, unknown> = {};
  if (entityType === "EXECUTION") {
    where.executionId = entityId;
  } else if (entityType === "STEP_EXECUTION") {
    where.stepExecutionId = entityId;
  } else if (entityType === "TEST_CASE") {
    // For test case attachments, return empty array (test cases don't have direct attachments)
    return ok([]);
  } else {
    return err("Invalid entityType. Must be EXECUTION, STEP_EXECUTION, or TEST_CASE", 400);
  }

  const attachments = await prisma.attachment.findMany({
    where,
    include: {
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return ok(attachments);
}
