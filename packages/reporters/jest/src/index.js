"use strict";

/**
 * @qa-tm/jest-reporter
 *
 * Jest reporter that submits test results to the QA Test Management Tool.
 *
 * Usage in jest.config.js:
 *   reporters: [
 *     'default',
 *     ['@qa-tm/jest-reporter', {
 *       apiUrl: 'https://your-instance.com',
 *       apiKey: process.env.QATM_API_KEY,
 *       testCycleId: 'CYC-1',
 *       autoCreateCycle: true,
 *       cycleName: 'Jest Run',
 *       projectId: 'proj_xxx',
 *     }]
 *   ]
 */

const KEY_PATTERN = /\[([A-Z]+-\d+|TC-\d+)\]/;

class QATMJestReporter {
  constructor(_globalConfig, options = {}) {
    this._opts = options;
  }

  async onRunComplete(_contexts, results) {
    const { apiUrl, apiKey, testCycleId, autoCreateCycle, cycleName, projectId, framework } = this._opts;

    if (!apiUrl || !apiKey) {
      console.warn("[qa-tm] Missing apiUrl or apiKey — results not submitted.");
      return;
    }

    const testResults = [];
    for (const suite of results.testResults) {
      for (const test of suite.testResults) {
        const fullName = test.fullName;
        const match = fullName.match(KEY_PATTERN);
        testResults.push({
          testCaseKey: match ? match[1] : undefined,
          title: fullName,
          status: test.status === "passed" ? "pass" : test.status === "pending" ? "skipped" : "fail",
          duration: test.duration ?? 0,
          error: test.failureMessages?.join("\n") || undefined,
        });
      }
    }

    const payload = {
      projectId,
      testCycleId,
      cycleName: autoCreateCycle ? (cycleName ?? `Jest Run ${new Date().toISOString()}`) : undefined,
      autoCreateCycle,
      framework: framework ?? "jest",
      results: testResults,
    };

    try {
      const res = await fetch(`${apiUrl}/api/automation/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[qa-tm] Submission failed (${res.status}): ${text}`);
        return;
      }

      const data = await res.json();
      console.log(`\n[qa-tm] ✓ ${data.matched}/${data.total} results submitted → cycle ${data.cycleId}`);
    } catch (err) {
      console.error("[qa-tm] Network error submitting results:", err.message);
    }
  }
}

module.exports = QATMJestReporter;
