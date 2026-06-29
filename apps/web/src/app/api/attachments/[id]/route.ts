import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, err } from "@/lib/api-helpers";
import { readFile } from "fs/promises";
import path from "path";

const SAFE_STORAGE_KEY = /^uploads\/[a-zA-Z0-9\-_]+\.[a-zA-Z0-9]+$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return err("Not found", 404);

  // Handle base64-encoded attachments (from automation screenshots)
  if (attachment.storageKey.startsWith("data:") || attachment.storageKey.match(/^[A-Za-z0-9+/=]+$/)) {
    // Base64 data - return as image
    let base64Data = attachment.storageKey;
    if (base64Data.startsWith("data:")) {
      base64Data = base64Data.split(",")[1];
    }
    const buffer = Buffer.from(base64Data, "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  }

  // Handle file path storage
  if (!SAFE_STORAGE_KEY.test(attachment.storageKey)) return err("Invalid storage key", 400);

  const fullPath = path.join(process.cwd(), "public", attachment.storageKey);

  try {
    const buffer = await readFile(fullPath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${attachment.fileName}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch {
    return err("File not found on disk", 404);
  }
}
