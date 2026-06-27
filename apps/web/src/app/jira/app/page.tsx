import { verifyAtlassianJwt } from '@/lib/atlassian-jwt';
import { prisma } from '@/lib/prisma';
import { FolderOpen, RefreshCw, BookOpen, BarChart3, ExternalLink, AlertCircle } from 'lucide-react';

interface Props {
  searchParams: { jwt?: string; projectKey?: string; cloudId?: string };
}

async function getOverview(jiraBaseUrl: string) {
  // Show an aggregate view across all projects belonging to this tenant's JIRA
  const projects = await prisma.project.findMany({
    where: { jiraBaseUrl: { contains: new URL(jiraBaseUrl).hostname } },
    select: {
      id: true, key: true, name: true,
      _count: { select: { testCases: true, testCycles: true } },
    },
    take: 20,
  });

  return projects;
}

export default async function JiraAppPage({ searchParams }: Props) {
  const { jwt, projectKey = '' } = searchParams;

  if (!jwt) {
    return <div className="p-6 text-sm text-red-600">Unauthorized: open through JIRA.</div>;
  }

  const auth = await verifyAtlassianJwt(jwt);
  if (!auth) {
    return <div className="p-6 text-sm text-red-600">Unauthorized: invalid or expired JWT.</div>;
  }

  const tenant = auth.tenant!;
  const projects = await getOverview(tenant.baseUrl);
  const appOrigin = process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? '';

  return (
    <div className="p-4 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div>
          <h1 className="text-base font-bold text-gray-800">QA Test Management</h1>
          <p className="text-xs text-gray-400">{tenant.baseUrl}</p>
        </div>
        <a
          href={appOrigin}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open full app
        </a>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { href: `${appOrigin}/cases`, icon: <FolderOpen className="h-4 w-4 text-indigo-500" />, label: 'Test Cases' },
          { href: `${appOrigin}/cycles`, icon: <RefreshCw className="h-4 w-4 text-blue-500" />, label: 'Test Cycles' },
          { href: `${appOrigin}/plans`, icon: <BookOpen className="h-4 w-4 text-purple-500" />, label: 'Test Plans' },
          { href: `${appOrigin}/reports`, icon: <BarChart3 className="h-4 w-4 text-green-500" />, label: 'Reports' },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            {item.icon}
            <span className="text-sm font-medium text-gray-700">{item.label}</span>
            <ExternalLink className="h-3 w-3 text-gray-300 ml-auto" />
          </a>
        ))}
      </div>

      {/* Projects */}
      {projects.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Projects linked to {tenant.baseUrl.replace('https://', '')}
          </p>
          <div className="space-y-1">
            {projects.map((p) => (
              <a
                key={p.id}
                href={`${appOrigin}/cases?projectId=${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded px-2 py-2 hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
              >
                <span className="font-mono text-xs text-gray-400 w-16 shrink-0">{p.key}</span>
                <span className="text-sm text-gray-700 group-hover:text-blue-600 truncate flex-1">{p.name}</span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {p._count.testCases} cases · {p._count.testCycles} cycles
                </span>
              </a>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center space-y-2">
          <AlertCircle className="h-6 w-6 text-gray-300 mx-auto" />
          <p className="text-sm text-gray-500">No projects linked yet.</p>
          <p className="text-xs text-gray-400">
            In the full app, go to{' '}
            <a href={`${appOrigin}/settings`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              Settings
            </a>{' '}
            and set the JIRA Base URL to <code className="bg-gray-100 px-1 rounded">{tenant.baseUrl}</code>.
          </p>
        </div>
      )}
    </div>
  );
}
