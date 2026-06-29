"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Terminal, Copy, Check, Layers, Loader2, ChevronDown } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useProject } from "@/hooks/use-project";
import { cn } from "@/lib/utils";

interface AutomationRun {
  id: string;
  framework?: string | null;
  cycleName?: string | null;
  summary?: string | null;
  passCount?: number;
  failCount?: number;
  createdAt: string;
  testCycle?: {
    key?: string;
    summary?: string;
  } | null;
}

interface FrameworkSample {
  id: string;
  name: string;
  title: string;
  description: string;
}

const FRAMEWORKS: FrameworkSample[] = [
  { id: "cypress-mocha", name: "Cypress (Mocha)", title: "Cypress — Mocha (Standard)", description: "Uses the after:run hook. Tag tests with [TC-N] in the test title. Steps are auto-derived." },
  { id: "cypress-bdd", name: "Cypress (BDD)", title: "Cypress — BDD (Cucumber)", description: "Uses @badeball/cypress-cucumber-preprocessor. Tag scenarios with @TC-N." },
  { id: "playwright-mocha", name: "Playwright (Mocha)", title: "Playwright — Mocha (Standard)", description: "Custom Reporter class. Tag tests with [TC-N] in the test title." },
  { id: "playwright-bdd", name: "Playwright (BDD)", title: "Playwright — BDD (Cucumber)", description: "Uses playwright-bdd. Tag scenarios with @TC-N." },
  { id: "jest", name: "Jest", title: "Jest", description: "Standard test framework." },
  { id: "rest-api", name: "REST API", title: "REST API (any framework)", description: "Submit from any language or CI. Include steps for full per-step control." },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="bg-muted rounded-md p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2"><CopyButton text={code} /></div>
    </div>
  );
}

interface SampleCardProps {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SampleCard({ id, title, description, children }: SampleCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <Card id={id}>
      <CardHeader>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full hover:opacity-75 transition-opacity text-left"
        >
          <CardTitle className="text-base">{title}</CardTitle>
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </button>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

export default function AutomationPage() {
  const { selectedProjectId } = useProject();

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const frameworksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedProjectId) { setLoadingRuns(false); return; }
    fetch(`/api/automation/runs?projectId=${selectedProjectId}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) {
          console.error(`API returned status ${r.status}`);
          throw new Error(`HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        console.log("Automation runs fetched:", data);
        setRuns(Array.isArray(data) ? data : []);
        setLoadingRuns(false);
      })
      .catch(e => {
        console.error("Failed to fetch automation runs:", e);
        setRuns([]);
        setLoadingRuns(false);
      });
  }, [selectedProjectId]);

  const scrollToFramework = (frameworkId: string) => {
    const element = document.getElementById(frameworkId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      // Expand the section if collapsed
      const button = element.querySelector("button");
      if (button) {
        button.click();
      }
    }
  };

  return (
    <div className="w-full bg-background" data-testid="automation-page">
      <div className="w-full max-w-6xl mx-auto px-6 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="automation-page-title">Automation Integration</h1>
          <p className="text-sm text-muted-foreground" data-testid="automation-page-subtitle">Connect your test frameworks to automatically report results and step-level statuses.</p>
        </div>

        {/* Recent Runs */}
        <Card data-testid="automation-recent-runs-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2" data-testid="automation-recent-runs-title">
              <Terminal className="h-4 w-4" /> Recent Automation Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedProjectId ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="automation-no-project-message">Select a project to view automation runs.</p>
            ) : loadingRuns ? (
              <div className="flex justify-center py-6" data-testid="automation-loading-spinner">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4" data-testid="automation-no-runs-message">No automation runs yet. Start by integrating one of the frameworks below.</p>
            ) : (
              <div className="rounded-md border overflow-x-auto" data-testid="automation-table-container">
                <table className="w-full text-xs" data-testid="automation-runs-table">
                  <thead className="bg-muted/50 border-b" data-testid="automation-table-header">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground" data-testid="automation-header-framework">Framework</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground" data-testid="automation-header-cycle">Cycle</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground" data-testid="automation-header-pass">Pass</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground" data-testid="automation-header-fail">Fail</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground" data-testid="automation-header-date">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" data-testid="automation-table-body">
                    {runs.map((run) => (
                      <tr key={run.id} className="hover:bg-muted/20 transition-colors" data-testid={`automation-table-row-${run.id}`}>
                        <td className="px-4 py-3 text-xs">
                          {run.framework ? (
                            <Badge variant="secondary" className="text-xs capitalize" data-testid={`automation-framework-${run.id}`}>{run.framework.replace(/_/g, " ")}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-xs truncate">
                          {run.testCycle?.key && <span className="font-mono text-muted-foreground mr-2" data-testid={`automation-cycle-key-${run.id}`}>{run.testCycle.key}</span>}
                          <span data-testid={`automation-cycle-name-${run.id}`}>{run.cycleName ?? run.testCycle?.summary ?? "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-green-600" data-testid={`automation-pass-count-${run.id}`}>{run.passCount ?? 0}</td>
                        <td className="px-4 py-3 text-right font-medium text-destructive" data-testid={`automation-fail-count-${run.id}`}>{run.failCount ?? 0}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground" data-testid={`automation-date-${run.id}`}>{new Date(run.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Framework Badges - Clickable */}
        <div ref={frameworksRef} className="flex flex-wrap gap-2">
          {FRAMEWORKS.map((f) => (
            <button
              key={f.id}
              onClick={() => scrollToFramework(f.id)}
              className="hover:opacity-75 transition-opacity"
              title={`Click to view ${f.name} implementation`}
            >
              <Badge variant="secondary" className="cursor-pointer">{f.name}</Badge>
            </button>
          ))}
        </div>

        {/* Step 1 — API Key */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Terminal className="h-4 w-4" /> Step 1 — Get Your API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Go to <strong>Settings → API Keys</strong> to generate a key. Create a <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code> file in your test project:
            </p>
            <CodeBlock code={`QATM_API_URL=http://localhost:3000
QATM_API_KEY=qatm_your_key_here
QATM_PROJECT_ID=your_project_id_here
QATM_CYCLE_NAME=My Automation Run`} />
            <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Validation:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>API_URL must be accessible and respond to HEAD request</li>
                <li>API_KEY must be valid (starts with qatm_) and exist in database</li>
                <li>PROJECT_ID must exist and user must have access</li>
                <li>CYCLE_NAME must be non-empty string (max 255 chars)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Step-level reporting */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Layers className="h-4 w-4" /> How Step-Level Reporting Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="space-y-2">
              <div>
                <span className="font-medium text-foreground block mb-1">BDD (Cucumber):</span>
                Each Given/When/Then step is reported individually with its own PASS/FAIL status.
              </div>
              <div>
                <span className="font-medium text-foreground block mb-1">Mocha / Standard:</span>
                <div className="space-y-1">
                  <div>Optional: Include <code className="text-xs bg-muted px-1 py-0.5 rounded">failingStepIndex</code> (0-based) to mark exact step that failed.</div>
                  <div>Without it: PASS → all steps pass; FAIL → all steps marked as failed.</div>
                  <div>With it: Steps before the failure marked PASS, the failing step shows the error, steps after marked NOT_EXECUTED.</div>
                </div>
              </div>
              <div>
                <span className="font-medium text-foreground block mb-1">REST API:</span>
                Include a <code className="text-xs bg-muted px-1 py-0.5 rounded">steps</code> array in each result for full per-step control.
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md p-3 text-xs text-red-800 dark:text-red-200">
              <strong>Failure Scenarios:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Test case key not found → entire result rejected</li>
                <li>Invalid step index → step skipped or test rejected</li>
                <li>Missing status field → defaulted to "unknown"</li>
                <li>Malformed step array → steps are ignored, result proceeds with main status</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Cypress Mocha */}
        <SampleCard
          id="cypress-mocha"
          title="Cypress — Mocha (Standard)"
          description="Uses the after:run hook. Tag tests with [TC-N] in the test title. Steps are auto-derived."
        >
          <p className="text-sm text-muted-foreground">Tag tests with <code className="text-xs bg-muted px-1 py-0.5 rounded">[TC-1]</code> format to link to test cases. The key must match your test case keys exactly.</p>
          <CodeBlock code={`// cypress.config.js — setupNodeEvents
on('after:run', async (results) => {
  const testResults = [];
  for (const run of results.runs || []) {
    for (const test of run.tests || []) {
      const title = test.title.join(' ');
      const keyMatch = title.match(/\\[TC-(\\d+)\\]/);
      testResults.push({
        testCaseKey: keyMatch ? \`TC-\${keyMatch[1]}\` : undefined,
        title,
        status: test.state === 'passed' ? 'pass' : test.state === 'failed' ? 'fail' : 'skipped',
        duration: test.attempts?.[0]?.duration ?? 0,
        error: test.displayError || undefined,
      });
    }
  }
  // POST testResults to /api/automation/submit with x-api-key header
});

// cypress/e2e/sample.cy.js
it('[TC-1] Login page loads successfully', () => {
  cy.visit('/login');
  cy.get('input[type="email"]').should('exist');
});`} />
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Common Failures:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Test key not matching test case → result ignored</li>
              <li>Missing [TC-N] tag → no linking to test case</li>
              <li>Network timeout on POST → retry needed</li>
              <li>Invalid API key in header → 401 response</li>
            </ul>
          </div>
        </SampleCard>

        {/* Cypress BDD */}
        <SampleCard
          id="cypress-bdd"
          title="Cypress — BDD (Cucumber)"
          description="Uses @badeball/cypress-cucumber-preprocessor. Tag scenarios with @TC-N."
        >
          <p className="text-sm text-muted-foreground">Each Gherkin step is reported with its own status. Tag scenarios with <code className="text-xs bg-muted px-1 py-0.5 rounded">@TC-3</code> format.</p>
          <CodeBlock code="npm install --save-dev cypress @badeball/cypress-cucumber-preprocessor @bahmutov/cypress-esbuild-preprocessor esbuild" />
          <CodeBlock code={`# .cypress-cucumber-preprocessorrc.json
{ "json": { "enabled": true, "output": "cypress/cucumber-report.json" } }

# features/login.feature
@TC-3
Scenario: Login page displays the authentication form
  Given I open the login page
  When the page finishes loading
  Then I can see the email input field
  And I can see the password input field`} />
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Common Failures:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Missing @TC-N tag → scenario not linked</li>
              <li>Cucumber report not generated → no step data sent</li>
              <li>Step keyword mismatch with test case → step validation fails</li>
            </ul>
          </div>
        </SampleCard>

        {/* Playwright Mocha */}
        <SampleCard
          id="playwright-mocha"
          title="Playwright — Mocha (Standard)"
          description="Custom Reporter class. Tag tests with [TC-N] in the test title."
        >
          <p className="text-sm text-muted-foreground">Create a custom reporter to extract test case keys and send results.</p>
          <CodeBlock code="npm install --save-dev @playwright/test" />
          <CodeBlock code={`// playwright.config.ts
reporter: [['list'], ['./reporters/qa-reporter.ts']]

// tests/sample.spec.ts
test('[TC-4] Login page redirects unauthenticated users', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/login/);
});`} />
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Common Failures:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Reporter not configured → results not sent</li>
              <li>Test title without [TC-N] → no linking</li>
              <li>Reporter crashes → entire test suite fails</li>
            </ul>
          </div>
        </SampleCard>

        {/* Playwright BDD */}
        <SampleCard
          id="playwright-bdd"
          title="Playwright — BDD (Cucumber)"
          description="Uses playwright-bdd. Tag scenarios with @TC-N."
        >
          <p className="text-sm text-muted-foreground">Step results extracted from Playwright's built-in step trace.</p>
          <CodeBlock code="npm install --save-dev @playwright/test playwright-bdd" />
          <CodeBlock code={`# features/login.feature
@TC-6
Scenario: Application redirects unauthenticated users to login
  Given the application is running
  When I navigate to the root URL
  Then I should be redirected to the login page

# Run
npx bddgen && npx playwright test`} />
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Common Failures:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>bddgen not run before playwright test → steps not generated</li>
              <li>Missing @TC-N tag → scenario skipped</li>
              <li>Feature file syntax errors → bddgen fails</li>
            </ul>
          </div>
        </SampleCard>

        {/* REST API */}
        <SampleCard
          id="rest-api"
          title="REST API (any framework)"
          description="Submit from any language or CI. Include steps for full per-step control."
        >
          <p className="text-sm text-muted-foreground">Use this for custom frameworks or languages not listed above. POST JSON to your QA Test Manager instance.</p>
          <CodeBlock code={`curl -X POST http://localhost:3000/api/automation/submit \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "proj_abc",
    "cycleName": "CI Run",
    "framework": "jest",
    "results": [
      {
        "testCaseKey": "TC-1",
        "status": "pass",
        "duration": 1234,
        "steps": [
          { "stepIndex": 0, "status": "pass" },
          { "stepIndex": 1, "status": "pass" }
        ]
      },
      {
        "testCaseKey": "TC-2",
        "status": "fail",
        "duration": 567,
        "error": "Expected true but got false",
        "failingStepIndex": 1,
        "screenshot": "data:image/png;base64,...",
        "steps": [
          { "stepIndex": 0, "status": "pass" },
          { "stepIndex": 1, "status": "fail", "actualResult": "Expected true but got false" }
        ]
      }
    ]
  }'`} />
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3 text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Common Failures:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Missing x-api-key header → 401 Unauthorized</li>
              <li>Invalid projectId → 404 Not Found</li>
              <li>testCaseKey doesn't exist → result rejected</li>
              <li>Invalid status (not pass/fail/skipped) → rejected</li>
              <li>stepIndex out of range → step ignored</li>
              <li>Malformed JSON → 400 Bad Request</li>
            </ul>
          </div>
        </SampleCard>
      </div>
    </div>
  );
}
