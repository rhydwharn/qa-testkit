import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";
import bcryptjs from "bcryptjs";

const schema = z.object({
  token: z.string().min(1, "Token is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, email, password } = schema.parse(body);

    // Find and validate reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
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

    // Hash new password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Update user password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    });

    // Delete all reset tokens for this user (single-use)
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    });

    return ok({ message: "Password reset successful" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err(error.errors[0].message, 400);
    }
    console.error("Reset password error:", error);
    return err("Failed to reset password", 500);
  }
}
