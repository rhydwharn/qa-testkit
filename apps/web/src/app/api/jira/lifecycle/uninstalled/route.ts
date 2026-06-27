import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractJwt, verifyAtlassianJwt } from '@/lib/atlassian-jwt';

export async function POST(req: NextRequest) {
  try {
    const token = extractJwt(req.headers, req.url);
    if (!token) {
      return Response.json({ error: 'No JWT provided' }, { status: 401 });
    }

    const result = await verifyAtlassianJwt(token, 'POST', req.url);
    if (!result) {
      return Response.json({ error: 'Invalid JWT' }, { status: 401 });
    }

    await prisma.jiraTenant.update({
      where: { clientKey: result.tenant!.clientKey },
      data: { isActive: false, uninstalledAt: new Date() },
    });

    console.log(`[lifecycle/uninstalled] tenant deactivated: ${result.tenant!.clientKey}`);
    return Response.json({ message: 'Uninstalled successfully' }, { status: 200 });
  } catch (error) {
    console.error('[lifecycle/uninstalled] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
