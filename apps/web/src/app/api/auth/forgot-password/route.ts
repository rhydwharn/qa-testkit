import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if email exists for security
      return ok({ message: "If that email exists, we've sent a reset link." });
    }

    // Generate reset token
    const token = require("crypto").randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        token,
        email: user.email,
        userId: user.id,
        expiresAt,
      },
    });

    // TODO: Send email with reset link
    // For now, just log it (in production, use Resend or similar)
    console.log(`Password reset link: /reset-password?token=${token}&email=${encodeURIComponent(user.email)}`);

    return ok({ message: "If that email exists, we've sent a reset link." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err(error.errors[0].message, 400);
    }
    console.error("Forgot password error:", error);
    return err("Failed to process request", 500);
  }
}
