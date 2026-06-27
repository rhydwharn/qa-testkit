'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, ExternalLink, Plus } from 'lucide-react';

type ExecStatus = 'NOT_RUN' | 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED';
type CaseStatus = 'DRAFT' | 'READY' | 'DEPRECATED';

interface LinkedCase {
  id: string;
  key: string;
  summary: string;
  status: CaseStatus;
  projectId: string;
  project: { name: string };
  versions: Array<{ executions: Array<{ status: ExecStatus }> }>;
}

const STATUS_ICON: Record<ExecStatus, React.ReactNode> = {
  PASS: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  FAIL: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  BLOCKED: <AlertCircle className="h-3.5 w-3.5 text-orange-500" />,
  IN_PROGRESS: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  NOT_RUN: <Clock className="h-3.5 w-3.5 text-gray-400" />,
  SKIPPED: <Clock className="h-3.5 w-3.5 text-gray-400" />,
};

const CASE_STATUS_COLOR: Record<CaseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  READY: 'bg-green-100 text-green-700',
  DEPRECATED: 'bg-red-100 text-red-600',
};

function latestExecStatus(tc: LinkedCase): ExecStatus {
  return tc.versions[0]?.executions[0]?.status ?? 'NOT_RUN';
}

export default function IssuePanelClient({
  cases,
  issueKey,
  jiraBaseUrl,
}: {
  cases: LinkedCase[];
  issueKey: string;
  projectKey: string;
  cloudId: string;
  jiraBaseUrl: string;
}) {
  const [expanded, setExpanded] = useState(true);

  const appBase = typeof window !== 'undefined' ? window.location.origin : '';

  if (cases.length === 0) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold text-xs text-gray-700">Test Cases</span>
          <a
            href={`${appBase}/cases?jiraIssueKey=${issueKey}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Link a test case
          </a>
        </div>
        <p className="text-xs text-gray-400 italic">
          No test cases linked to {issueKey} yet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          className="font-semibold text-xs text-gray-700 flex items-center gap-1"
          onClick={() => setExpanded((e) => !e)}
        >
          Test Cases
          <span className="bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 text-[10px]">
            {cases.length}
          </span>
        </button>
        <a
          href={`${appBase}/cases`}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" /> Open
        </a>
      </div>

      {expanded && (
        <div className="space-y-1">
          {cases.map((tc) => {
            const execStatus = latestExecStatus(tc);
            return (
              <a
                key={tc.id}
                href={`${appBase}/cases/${tc.id}?projectId=${tc.projectId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50 transition-colors group"
              >
                {STATUS_ICON[execStatus]}
                <span className="font-mono text-[10px] text-gray-400 shrink-0">{tc.key}</span>
                <span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-600">
                  {tc.summary}
                </span>
                <span
                  className={`text-[10px] rounded px-1 py-0.5 shrink-0 ${CASE_STATUS_COLOR[tc.status]}`}
                >
                  {tc.status}
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
