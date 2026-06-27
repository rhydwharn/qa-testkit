import { createHmac, createHash, timingSafeEqual } from 'crypto';
import { prisma } from './prisma';

export interface JwtClaims {
  iss: string;
  iat: number;
  exp: number;
  qsh: string;
  sub?: string;
  context?: Record<string, unknown>;
}

function base64urlDecode(str: string): Buffer {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyHs256(token: string, secret: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  const hmac = createHmac('sha256', secret);
  hmac.update(`${header}.${payload}`);
  // digest as base64url
  const expectedSig = Buffer.from(
    hmac.digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  );

  try {
    const sigBuf = base64urlDecode(signature);
    if (sigBuf.length !== expectedSig.length) return null;
    if (!timingSafeEqual(sigBuf, expectedSig)) return null;
  } catch {
    return null;
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64urlDecode(payload).toString('utf-8'));
  } catch {
    return null;
  }

  // Allow 60-second clock skew
  if (claims.exp && claims.exp + 60 < Math.floor(Date.now() / 1000)) return null;

  return claims;
}

export function computeQsh(method: string, url: string): string {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  params.delete('jwt');

  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonical = `${method.toUpperCase()}&${parsed.pathname}&${sortedParams}`;
  return createHash('sha256').update(canonical).digest('hex');
}

export async function verifyAtlassianJwt(
  token: string,
  method = 'GET',
  url?: string
): Promise<{ claims: JwtClaims; tenant: Awaited<ReturnType<typeof getTenant>> } | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let unverified: JwtClaims;
  try {
    unverified = JSON.parse(base64urlDecode(parts[1]).toString('utf-8'));
  } catch {
    return null;
  }

  if (!unverified.iss) return null;

  const tenant = await getTenant(unverified.iss);
  if (!tenant) return null;

  const claims = verifyHs256(token, tenant.sharedSecret);
  if (!claims) return null;

  if (url && claims.qsh !== 'context-qsh') {
    const expected = computeQsh(method, url);
    if (claims.qsh !== expected) return null;
  }

  return { claims, tenant };
}

async function getTenant(clientKey: string) {
  return prisma.jiraTenant.findUnique({
    where: { clientKey, isActive: true },
  });
}

export function verifyHs256FromInstall(token: string, secret: string): boolean {
  return verifyHs256(token, secret) !== null;
}

export function extractJwt(headers: Headers, url: string): string | null {
  const auth = headers.get('authorization');
  if (auth?.startsWith('JWT ')) return auth.slice(4);

  try {
    return new URL(url).searchParams.get('jwt');
  } catch {
    return null;
  }
}
