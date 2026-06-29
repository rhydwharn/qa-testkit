import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Test basic connection
    const result = await prisma.$queryRaw`SELECT 1 as test`;

    // Try to count users
    const userCount = await prisma.user.count();

    return Response.json({
      success: true,
      message: "Database connection successful",
      userCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[test-db] Error:", error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
