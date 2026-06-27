import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const hashedPassword = await hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin User",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  // Create or reuse default tenant
  let tenant = await prisma.tenant.findUnique({ where: { slug: "default-workspace" } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: "Default Workspace", slug: "default-workspace" },
    });
  }

  // Ensure admin is a member (OWNER)
  await prisma.tenantMember.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: admin.id } },
    create: { tenantId: tenant.id, userId: admin.id, role: "OWNER" },
    update: {},
  });

  // Create a demo project scoped to this tenant
  const existing = await prisma.project.findFirst({
    where: { tenantId: tenant.id, key: "DEMO" },
  });
  if (!existing) {
    const project = await prisma.project.create({
      data: {
        key: "DEMO",
        name: "Demo Project",
        description: "A demo project to get you started.",
        tenantId: tenant.id,
        members: { create: { userId: admin.id, role: "OWNER" } },
        statuses: {
          create: [
            { name: "Draft", color: "#6b7280", type: "CASE", isDefault: true },
            { name: "Ready", color: "#22c55e", type: "CASE" },
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

    const highPriority = await prisma.priority.findFirst({
      where: { projectId: project.id, name: "High" },
    });

    const tc1 = await prisma.testCase.create({
      data: {
        key: "DEMO-TC-1",
        summary: "User can register with valid credentials",
        description: "Verify that a new user can complete registration.",
        status: "READY",
        projectId: project.id,
        priorityId: highPriority?.id,
        versions: {
          create: {
            versionNo: 1,
            isLatest: true,
            steps: {
              create: [
                { order: 1, stepDetails: "Navigate to /register", expectedResult: "Registration form is displayed" },
                { order: 2, stepDetails: "Fill in valid name, email, and password", expectedResult: "Fields are filled correctly" },
                { order: 3, stepDetails: "Click 'Create Account'", expectedResult: "User is redirected to dashboard" },
              ],
            },
          },
        },
      },
    });

    const tc2 = await prisma.testCase.create({
      data: {
        key: "DEMO-TC-2",
        summary: "User cannot login with invalid password",
        description: "Verify that invalid credentials are rejected.",
        status: "READY",
        projectId: project.id,
        versions: {
          create: {
            versionNo: 1,
            isLatest: true,
            steps: {
              create: [
                { order: 1, stepDetails: "Navigate to /login", expectedResult: "Login form is displayed" },
                { order: 2, stepDetails: "Enter valid email and incorrect password", expectedResult: "Credentials entered" },
                { order: 3, stepDetails: "Click 'Sign In'", expectedResult: "Error message shown: 'Invalid credentials'" },
              ],
            },
          },
        },
      },
    });

    const cycle = await prisma.testCycle.create({
      data: {
        key: "DEMO-CY-1",
        summary: "Sprint 1 Regression",
        description: "Full regression for Sprint 1 release.",
        status: "ACTIVE",
        projectId: project.id,
      },
    });

    const v1 = await prisma.testCaseVersion.findFirst({ where: { testCaseId: tc1.id, isLatest: true } });
    const v2 = await prisma.testCaseVersion.findFirst({ where: { testCaseId: tc2.id, isLatest: true } });

    if (v1 && v2) {
      await prisma.testCycleCase.createMany({
        data: [
          { testCycleId: cycle.id, testCaseId: tc1.id },
          { testCycleId: cycle.id, testCaseId: tc2.id },
        ],
      });
      await prisma.testCaseExecution.createMany({
        data: [
          { testCycleId: cycle.id, testCaseId: tc1.id, testCaseVersionId: v1.id, status: "PASS", duration: 1234 },
          { testCycleId: cycle.id, testCaseId: tc2.id, testCaseVersionId: v2.id, status: "NOT_RUN" },
        ],
      });
    }
  }

  console.log("✓ Seed completed");
  console.log("  Admin login: admin@example.com / admin123");
  console.log("  Workspace: Default Workspace (default-workspace)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
