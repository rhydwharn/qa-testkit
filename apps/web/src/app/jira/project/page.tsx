import { verifyAtlassianJwt } from '@/lib/atlassian-jwt';
import { prisma } from '@/lib/prisma';
import { CheckCircle2, XCircle, Clock, FolderOpen, RefreshCw, ExternalLink } from 'lucide-react';

interface Props {
  searchParams: { jwt?: string; projectKey?: string; cloudId?: string };
}

async function getProjectStats(jiraProjectKey: string) {
  // Find the project mapped to this JIRA project key
  const project = await prisma.project.findFirst({
    where: { jiraProjectKey },
    select: {
      id: true,
      name: true,
      key: true,
      _count: {
        select: { testCases: true, testCycles: true, testPlans: true },
      },
    },
  });
  if (!project) return null;

  const [recentCycles, execStats] = await Promise.all([
    prisma.testCycle.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, key: true, summary: true, status: true, _count: { select: { executions: true } } },
    }),
    prisma.testCaseExecution.groupBy({
      by: ['status'],
      where: { testCycle: { projectId: project.id } },
      _count: true,
    }),
  ]);

  const statsMap = Object.fromEntries(execStats.map((e) => [e.status, e._count]));

  return { project, recentCycles, statsMap };
}

export default async function JiraProjectPage({ searchParams }: Props) {
  const { jwt, projectKey = '', cloudId = '' } = searchParams;

  if (!jwt) {
    return <div className="p-4 text-xs text-red-600">Unauthorized: no JWT. Open through JIRA.</div>;
  }

  const auth = await verifyAtlassianJwt(jwt);
  if (!auth) {
    return <div className="p-4 text-xs text-red-600">Unauthorized: invalid or expired JWT.</div>;
  }

  const data = await getProjectStats(projectKey);

  const appOrigin = process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? '';

  if (!data) {
    return (
      <div className="p-4 space-y-3">
        <h2 className="font-semibold text-sm">QA Test Management</h2>
        <div className="text-xs text-gray-500 space-y-1">
          <p>
            No project is linked to JIRA project <code className="bg-gray-100 px-1 rounded">{projectKey}</code>.
          </p>
          <p>
            Go to{' '}
            <a
              href={`${appOrigin}/settings`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline"
            >
              Settings
            </a>{' '}
            and set the JIRA Project Key to <strong>{projectKey}</strong>.
          </p>
        </div>
      </div>
    );
  }

  const { project, recentCycles, statsMap } = data;
  const pass = statsMap['PASS'] ?? 0;
  const fail = statsMap['FAIL'] ?? 0;
  const notRun = statsMap['NOT_RUN'] ?? 0;
  const total = pass + fail + notRun + (statsMap['BLOCKED'] ?? 0) + (statsMap['SKIPPED'] ?? 0) + (statsMap['IN_PROGRESS'] ?? 0);

  const CYCLE_STATUS: Record<string, string> = {
    DRAFT: 'text-gray-500',
    ACTIVE: 'text-blue-600',
    CLOSED: 'text-green-600',
  };

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">{project.name}</h2>
          <span className="text-[10px] font-mono text-gray-400">{project.key}</span>
        </div>
        <a
          href={`${appOrigin}/cases?projectId=${project.id}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Test Cases', value: project._count.testCases, icon: <FolderOpen className="h-3.5 w-3.5 text-indigo-500 mx-auto mb-0.5" /> },
          { label: 'Cycles', value: project._count.testCycles, icon: <RefreshCw className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" /> },
          { label: 'Plans', value: project._count.testPlans, icon: <Clock className="h-3.5 w-3.5 text-purple-500 mx-auto mb-0.5" /> },
        ].map((s) => (
          <div key={s.label} className="bg-gray-50 rounded p-2">
            {s.icon}
            <div className="text-base font-bold">{s.value}</div>
            <div className="text-[10px] text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Execution summary */}
      {total > 0 && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1">EXECUTION SUMMARY</p>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" /> {pass} pass
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="h-3 w-3" /> {fail} fail
            </span>
            <span className="flex items-center gap-1 text-gray-400">
              <Clock className="h-3 w-3" /> {notRun} not run
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 flex h-1.5 rounded overflow-hidden bg-gray-100">
            {pass > 0 && <div className="bg-green-500" style={{ width: `${(pass / total) * 100}%` }} />}
            {fail > 0 && <div className="bg-red-400" style={{ width: `${(fail / total) * 100}%` }} />}
          </div>
        </div>
      )}

      {/* Recent cycles */}
      {recentCycles.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-gray-500 mb-1">RECENT CYCLES</p>
          <div className="space-y-1">
            {recentCycles.map((c) => (
              <a
                key={c.id}
                href={`${appOrigin}/cycles/${c.id}?projectId=${project.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 transition-colors group"
              >
                <RefreshCw className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="font-mono text-[10px] text-gray-400 shrink-0">{c.key}</span>
                <span className="text-xs truncate flex-1 group-hover:text-blue-600">{c.summary}</span>
                <span className={`text-[10px] ${CYCLE_STATUS[c.status] ?? 'text-gray-500'}`}>
                  {c.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
