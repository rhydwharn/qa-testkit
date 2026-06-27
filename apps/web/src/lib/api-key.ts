import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = `qatm_${randomBytes(32).toString("hex")}`;
  const prefix = raw.slice(0, 12);
  const hash = createHash("sha256").update(raw).digest("hex");
  return { key: raw, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
