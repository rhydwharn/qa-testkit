import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";

export async function DELETE(req: NextRequest, { params }: { params: { id: string; no: string } }) {
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const versionNo = parseInt(params.no);
  if (isNaN(versionNo)) return err("Invalid version number");

  const version = await prisma.testCaseVersion.findUnique({
    where: { testCaseId_versionNo: { testCaseId: params.id, versionNo } },
  });

  if (!version) return err("Version not found", 404);

  // Cannot delete latest version or the only version
  if (version.isLatest) {
    return err("Cannot delete the latest version");
  }

  const versionCount = await prisma.testCaseVersion.count({
    where: { testCaseId: params.id },
  });

  if (versionCount <= 1) {
    return err("Cannot delete the only version");
  }

  // Delete all steps first
  await prisma.testStep.deleteMany({
    where: { versionId: version.id },
  });

  // Delete the version
  await prisma.testCaseVersion.delete({
    where: { id: version.id },
  });

  return ok({ deleted: true, versionNo });
}
