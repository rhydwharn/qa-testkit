import { Suspense } from 'react';
import { verifyAtlassianJwt } from '@/lib/atlassian-jwt';
import { prisma } from '@/lib/prisma';
import IssuePanelClient from './client';

interface Props {
  searchParams: { jwt?: string; issueKey?: string; projectKey?: string; cloudId?: string };
}

async function getLinkedCases(issueKey: string) {
  if (!issueKey) return [];
  return prisma.testCase.findMany({
    where: { jiraRequirementKeys: { has: issueKey } },
    select: {
      id: true,
      key: true,
      summary: true,
      status: true,
      projectId: true,
      project: { select: { name: true } },
      versions: {
        where: { isLatest: true },
        take: 1,
        select: {
          executions: {
            orderBy: { executedAt: 'desc' },
            take: 1,
            select: { status: true },
          },
        },
      },
    },
    take: 50,
  });
}

export default async function IssuePanelPage({ searchParams }: Props) {
  const { jwt, issueKey = '', projectKey = '', cloudId = '' } = searchParams;

  // Validate the Atlassian JWT — every module request from JIRA carries one
  if (!jwt) {
    return (
      <div className="p-4 text-xs text-red-600">
        Unauthorized: no JWT provided. Open this page through JIRA.
      </div>
    );
  }

  const auth = await verifyAtlassianJwt(jwt);
  if (!auth) {
    return (
      <div className="p-4 text-xs text-red-600">
        Unauthorized: invalid or expired JWT.
      </div>
    );
  }

  const cases = await getLinkedCases(issueKey);

  return (
    <Suspense fallback={<div className="p-4 text-xs text-muted-foreground">Loading…</div>}>
      <IssuePanelClient
        cases={cases}
        issueKey={issueKey}
        projectKey={projectKey}
        cloudId={cloudId}
        jiraBaseUrl={auth.tenant!.baseUrl}
      />
    </Suspense>
  );
}
