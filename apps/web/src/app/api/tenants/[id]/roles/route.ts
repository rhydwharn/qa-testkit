import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenantAccess } from "@/lib/api-helpers";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.tenantId) return err("Forbidden", 403);

    const roles = await prisma.customRole.findMany({
      where: { tenantId: params.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return ok({ roles });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return err("Failed to fetch roles", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  try {
    const { error, caller } = await requireTenantAccess(req);
    if (error) return error;
    if (!caller) return err("Unauthorized", 401);
    if (caller.tenantId !== params.tenantId) return err("Forbidden", 403);

    // Check if user is tenant owner/admin
    const membership = await prisma.tenantMember.findUnique({
      where: {
        tenantId_userId: {
          tenantId: params.tenantId,
          userId: (caller as any).userId,
        },
      },
    });

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      return err("Only workspace owners/admins can create roles", 403);
    }

    const body = await req.json();
    const parsed = createRoleSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0]?.message ?? "Validation failed", 400);

    const { name, description } = parsed.data;

    // Check if role name already exists in this tenant
    const existing = await prisma.customRole.findFirst({
      where: { tenantId: params.tenantId, name },
    });
    if (existing) return err("A role with this name already exists", 409);

    const role = await prisma.customRole.create({
      data: {
        tenantId: params.tenantId,
        name,
        description: description || null,
      },
    });

    // Initialize permissions for all features (enabled by default)
    const features = [
      "TEST_CASE_CREATE", "TEST_CASE_READ", "TEST_CASE_UPDATE", "TEST_CASE_DELETE",
      "TEST_CASE_CLONE", "TEST_CASE_IMPORT", "TEST_CASE_EXPORT", "TEST_CASE_ARCHIVE",
      "TEST_CYCLE_CREATE", "TEST_CYCLE_READ", "TEST_CYCLE_UPDATE", "TEST_CYCLE_DELETE",
      "TEST_CYCLE_EXECUTE", "TEST_CYCLE_CLONE", "TEST_CYCLE_ARCHIVE",
      "TEST_PLAN_CREATE", "TEST_PLAN_READ", "TEST_PLAN_UPDATE", "TEST_PLAN_DELETE",
      "TEST_PLAN_ARCHIVE", "PROJECT_SETTINGS_MANAGE", "PROJECT_MEMBERS_MANAGE",
      "PROJECT_AUTOMATION_SUBMIT", "PROJECT_REPORTS_VIEW", "PROJECT_COMMENTS_CREATE",
      "PROJECT_FILTERS_MANAGE", "JIRA_INTEGRATION",
    ];

    for (const feature of features) {
      let featureFlag = await prisma.featureFlag.findFirst({
        where: { tenantId: params.tenantId, featureName: feature },
      });

      if (!featureFlag) {
        featureFlag = await prisma.featureFlag.create({
          data: {
            tenantId: params.tenantId,
            featureName: feature,
            description: feature.replace(/_/g, " "),
            isEnabled: true,
          },
        });
      }

      await prisma.rolePermission.create({
        data: {
          featureFlagId: featureFlag.id,
          customRoleId: role.id,
          isEnabled: true,
        },
      });
    }

    return ok(role, 201);
  } catch (error) {
    console.error("Error creating role:", error);
    return err("Failed to create role", 500);
  }
}
