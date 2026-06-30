import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    const email = req.nextUrl.searchParams.get("email");

    if (!token || !email) {
      return err("Token and email are required", 400);
    }

    // Find reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return err("Invalid reset token", 400);
    }

    // Check if token is expired
    if (resetToken.expiresAt < new Date()) {
      return err("Reset token has expired", 400);
    }

    // Check if email matches
    if (resetToken.email !== email) {
      return err("Email does not match reset token", 400);
    }

    return ok({ valid: true, email: resetToken.email });
  } catch (error) {
    console.error("Validate reset token error:", error);
    return err("Failed to validate token", 500);
  }
}
