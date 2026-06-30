import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { err, ok } from "@/lib/api-helpers";
import { z } from "zod";
import { PasswordResetEmail } from "@/lib/email-templates/password-reset";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

async function sendPasswordResetEmail(email: string, resetLink: string, userName?: string) {
  // Only attempt to send email if Resend API key is available
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV MODE - Email Not Sent]\nRecipient: ${email}\nReset Link: ${resetLink}`);
    return;
  }

  try {
    // Dynamically require Resend to make it optional at build time
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resend } = require("resend") as { Resend: any };
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "noreply@qa-testkit.com",
      to: email,
      subject: "Reset your QA Testkit password",
      react: PasswordResetEmail({ resetLink, userName }) as React.ReactElement,
    });

    console.log(`Password reset email sent to ${email}`);
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError);
    // Don't fail the request - user can still reset via token
  }
}

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

    // Send email with reset link
    const resetLink = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    // Send email asynchronously (don't wait for it)
    sendPasswordResetEmail(user.email, resetLink, user.name || undefined).catch(console.error);

    return ok({ message: "If that email exists, we've sent a reset link." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return err(error.errors[0].message, 400);
    }
    console.error("Forgot password error:", error);
    return err("Failed to process request", 500);
  }
}
