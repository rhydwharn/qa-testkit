"use strict";

/**
 * @qa-tm/cypress-reporter
 *
 * Cypress Mocha reporter that submits test results to the QA Test Management Tool.
 *
 * Usage in cypress.config.js:
 *   reporter: '@qa-tm/cypress-reporter',
 *   reporterOptions: {
 *     apiUrl: 'https://your-instance.com',
 *     apiKey: process.env.QATM_API_KEY,
 *     testCycleId: 'CYC-1',          // existing cycle id
 *     autoCreateCycle: false,         // or true
 *     cycleName: 'Regression Run',    // used when autoCreateCycle=true
 *     projectId: 'proj_xxx',          // required when autoCreateCycle=true
 *     framework: 'cypress',
 *   }
 */

const Mocha = require("mocha");
const { EVENT_RUN_END, EVENT_TEST_PASS, EVENT_TEST_FAIL, EVENT_TEST_PENDING } = Mocha.Runner.constants;

const KEY_PATTERN = /\[([A-Z]+-\d+|TC-\d+)\]/;

class QATMReporter {
  constructor(runner, options) {
    const opts = options?.reporterOptions ?? {};
    this._results = [];
    this._opts = opts;

    runner.on(EVENT_TEST_PASS, (test) => {
      this._results.push({
        testCaseKey: this._extractKey(test.title),
        title: test.title,
        status: "pass",
        duration: test.duration ?? 0,
      });
    });

    runner.on(EVENT_TEST_FAIL, (test, err) => {
      this._results.push({
        testCaseKey: this._extractKey(test.title),
        title: test.title,
        status: "fail",
        duration: test.duration ?? 0,
        error: err?.message ?? String(err),
      });
    });

    runner.on(EVENT_TEST_PENDING, (test) => {
      this._results.push({
        testCaseKey: this._extractKey(test.title),
        title: test.title,
        status: "skipped",
        duration: 0,
      });
    });

    runner.on(EVENT_RUN_END, async () => {
      await this._submit();
    });
  }

  _extractKey(title) {
    const match = title.match(KEY_PATTERN);
    return match ? match[1] : undefined;
  }

  async _submit() {
    const { apiUrl, apiKey, testCycleId, autoCreateCycle, cycleName, projectId, framework } = this._opts;

    if (!apiUrl || !apiKey) {
      console.warn("[qa-tm] Missing apiUrl or apiKey — results not submitted.");
      return;
    }

    if (!testCycleId && !autoCreateCycle) {
      console.warn("[qa-tm] No testCycleId and autoCreateCycle=false — results not submitted.");
      return;
    }

    const payload = {
      projectId,
      testCycleId,
      cycleName: autoCreateCycle ? (cycleName ?? `Cypress Run ${new Date().toISOString()}`) : undefined,
      autoCreateCycle,
      framework: framework ?? "cypress",
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
      console.log(`[qa-tm] ✓ Submitted ${data.matched}/${data.total} results (${data.unmatched} unmatched) → cycle ${data.cycleId}`);
    } catch (err) {
      console.error("[qa-tm] Network error submitting results:", err.message);
    }
  }
}

module.exports = QATMReporter;
