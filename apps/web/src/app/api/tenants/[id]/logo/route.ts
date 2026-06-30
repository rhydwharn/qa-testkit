import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, ok, err } from "@/lib/api-helpers";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Magic byte signatures for image validation
const MAGIC_BYTES: Record<string, Uint8Array> = {
  "image/jpeg": new Uint8Array([0xFF, 0xD8, 0xFF]),
  "image/png": new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  "image/webp": new Uint8Array([0x52, 0x49, 0x46, 0x46]),
  "image/gif": new Uint8Array([0x47, 0x49, 0x46]),
  "image/svg+xml": new Uint8Array([0x3C, 0x3F, 0x76]), // <?v in UTF-8
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signature = MAGIC_BYTES[mimeType];
  if (!signature) return true; // Allow unknown types (skip validation)
  return signature.every((byte, i) => buffer[i] === byte);
}

const LOGO_DIR = path.join(process.cwd(), "public", "uploads", "logos");
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_SIZE = 200 * 1024; // 200 KB

async function requireOwnerOrAdmin(tenantId: string, userId: string) {
  const membership = await prisma.tenantMember.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
  return membership && ["OWNER", "ADMIN"].includes(membership.role);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const allowed = await requireOwnerOrAdmin(id, caller.userId);
  if (!allowed) return err("Forbidden", 403);

  const formData = await req.formData().catch(() => null);
  if (!formData) return err("Invalid form data");

  const file = formData.get("file") as File | null;
  if (!file) return err("No file provided");
  if (!ALLOWED_MIME.has(file.type)) return err("Only image files are allowed (JPEG, PNG, WebP, GIF, SVG)");
  if (file.size > MAX_SIZE) return err("Logo must be 200 KB or smaller");

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Validate magic bytes to prevent file type spoofing
  if (!validateMagicBytes(buffer, file.type)) {
    return err("File type validation failed - file content does not match declared type");
  }

  const ext = file.type === "image/svg+xml" ? "svg" : (file.name.split(".").pop() ?? "png");
  const uniqueName = `${randomUUID()}.${ext}`;
  const storageKey = `uploads/logos/${uniqueName}`;
  const fullPath = path.join(LOGO_DIR, uniqueName);

  // Remove old logo file if present
  const existing = await prisma.tenant.findUnique({ where: { id }, select: { logoStorageKey: true } });
  if (existing?.logoStorageKey) {
    const oldPath = path.join(process.cwd(), "public", existing.logoStorageKey);
    await unlink(oldPath).catch(() => {});
  }

  await mkdir(LOGO_DIR, { recursive: true });
  await writeFile(fullPath, buffer);

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { logoStorageKey: storageKey, logoUrl: `/${storageKey}` },
    select: { id: true, logoUrl: true },
  });

  return ok(tenant);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await requireAuth(req);
  if (!caller) return err("Unauthorized", 401);

  const allowed = await requireOwnerOrAdmin(id, caller.userId);
  if (!allowed) return err("Forbidden", 403);

  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { logoStorageKey: true } });
  if (tenant?.logoStorageKey) {
    const filePath = path.join(process.cwd(), "public", tenant.logoStorageKey);
    await unlink(filePath).catch(() => {});
  }

  await prisma.tenant.update({
    where: { id },
    data: { logoStorageKey: null, logoUrl: null },
  });

  return ok({ deleted: true });
}
