import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyHs256FromInstall } from '@/lib/atlassian-jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });

    const { clientKey, sharedSecret, baseUrl, productType, description } = body as {
      clientKey?: string;
      sharedSecret?: string;
      baseUrl?: string;
      productType?: string;
      description?: string;
    };

    if (!clientKey || !sharedSecret || !baseUrl) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For re-installs, verify JWT signed by the old shared secret
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('JWT ')) {
      const existing = await prisma.jiraTenant.findUnique({ where: { clientKey } });
      if (existing) {
        const token = authHeader.slice(4);
        const ok = verifyHs256FromInstall(token, existing.sharedSecret);
        if (!ok) {
          return Response.json({ error: 'Invalid JWT for re-install' }, { status: 401 });
        }
      }
    }

    await prisma.jiraTenant.upsert({
      where: { clientKey },
      create: {
        clientKey,
        sharedSecret,
        baseUrl,
        productType: productType ?? 'jira',
        description,
        isActive: true,
      },
      update: {
        sharedSecret,
        baseUrl,
        productType: productType ?? 'jira',
        description,
        isActive: true,
        uninstalledAt: null,
      },
    });

    console.log(`[lifecycle/installed] tenant registered: ${clientKey} @ ${baseUrl}`);
    return Response.json({ message: 'Installed successfully' }, { status: 200 });
  } catch (error) {
    console.error('[lifecycle/installed] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
