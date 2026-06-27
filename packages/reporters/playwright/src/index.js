"use strict";

/**
 * @qa-tm/playwright-reporter
 *
 * Playwright reporter that submits test results to the QA Test Management Tool.
 *
 * Usage in playwright.config.ts:
 *   reporter: [
 *     ['@qa-tm/playwright-reporter', {
 *       apiUrl: 'https://your-instance.com',
 *       apiKey: process.env.QATM_API_KEY,
 *       testCycleId: 'CYC-1',
 *       autoCreateCycle: true,
 *       cycleName: 'Playwright Run',
 *       projectId: 'proj_xxx',
 *     }]
 *   ]
 */

const KEY_PATTERN = /\[([A-Z]+-\d+|TC-\d+)\]/;

class QATMPlaywrightReporter {
  constructor(options = {}) {
    this._opts = options;
    this._results = [];
  }

  onBegin(_config, _suite) {
    // nothing needed
  }

  onTestEnd(test, result) {
    const title = test.title;
    const match = title.match(KEY_PATTERN);
    const testCaseKey = match ? match[1] : undefined;

    const statusMap = { passed: "pass", failed: "fail", skipped: "skipped", timedOut: "fail" };

    this._results.push({
      testCaseKey,
      title,
      status: statusMap[result.status] ?? "skipped",
      duration: result.duration,
      error: result.error?.message ?? result.error?.value ?? undefined,
    });
  }

  async onEnd(_result) {
    const { apiUrl, apiKey, testCycleId, autoCreateCycle, cycleName, projectId, framework } = this._opts;

    if (!apiUrl || !apiKey) {
      console.warn("[qa-tm] Missing apiUrl or apiKey — results not submitted.");
      return;
    }

    const payload = {
      projectId,
      testCycleId,
      cycleName: autoCreateCycle ? (cycleName ?? `Playwright Run ${new Date().toISOString()}`) : undefined,
      autoCreateCycle,
      framework: framework ?? "playwright",
      results: this._results,
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
      if (data.unmatched > 0) {
        console.warn(`[qa-tm] ⚠ ${data.unmatched} tests had no matching test case: ${data.unmatchedKeys.join(", ")}`);
      }
    } catch (err) {
      console.error("[qa-tm] Network error submitting results:", err.message);
    }
  }
}

module.exports = QATMPlaywrightReporter;
