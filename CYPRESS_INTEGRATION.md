# Cypress Integration with QATM - Quick Reference

## Overview

Users can integrate step-level test execution tracking into their Cypress projects with **less than 2 pages of code**.

## Sample Project Location

See `/Documents/sample_qa_testkit_mocha_cypress/` for a complete, clean example with:
- ✅ QUICK_CHECKLIST.md - 5-minute integration
- ✅ INTEGRATION_GUIDE.md - Detailed documentation
- ✅ Working example test file
- ✅ All necessary configuration

## What Users Need to Add

### File 1: cypress/support/e2e.js (52 lines)
```javascript
let testSteps = [];
let stepIndex = 0;

Cypress.Commands.add('logStep', (stepName) => {
  const step = {
    stepIndex: stepIndex++,
    name: stepName,
    status: 'pass',
  };
  testSteps.push(step);
  console.log(`[Test Step ${step.stepIndex + 1}] ${stepName}`);
});

beforeEach(function() {
  testSteps = [];
  stepIndex = 0;
});

afterEach(function() {
  const testTitle = this.currentTest?.title || 'unknown';
  if (testSteps.length > 0) {
    cy.task('writeStepsFile', { testTitle, steps: testSteps });
  }
});

Cypress.on('uncaught:exception', () => false);
```

### File 2: scripts/cypress-automation-mocha.js (502 lines)
See sample project - includes:
- `parseTestFiles()` - Discover test case IDs
- `processAndSubmitResults()` - Submit to QATM API
- `tasks` object - File I/O handlers
- Screenshot capture logic
- Step extraction from code

### File 3: Update cypress.config.js (~15 lines)
```javascript
const { defineConfig } = require('cypress');
const { parseTestFiles, tasks, processAndSubmitResults } = require('./scripts/cypress-automation-mocha');

require('dotenv').config({ path: '.env.qatm' });

async function setupNodeEvents(on, config) {
  parseTestFiles();
  on('task', tasks);
  on('after:run', async (results) => {
    await processAndSubmitResults(results);
  });
  return config;
}

module.exports = defineConfig({
  e2e: {
    setupNodeEvents,
    // ... other config
  },
  reporter: 'mochawesome',
  reporterOptions: { reportDir: 'results', overwrite: false, html: false, json: true },
});
```

### File 4: .env.qatm (~6 lines)
```bash
QATM_API_URL=http://localhost:3000
QATM_API_KEY=your_key
QATM_PROJECT_ID=your_project_id
QATM_CYCLE_NAME=Cypress Automation Run
TEST_CASE_TAG_PATTERN=\[([A-Z0-9]+-[A-Za-z]+-\d+)\]
```

### Update Test Files
Add test ID and steps:
```javascript
it('[XP-TC-1] User can login', () => {
  cy.logStep('Navigate to login');
  cy.visit('/login');
  
  cy.logStep('Enter credentials');
  cy.get('input[name="email"]').type('user@test.com');
  cy.get('input[name="password"]').type('password');
  
  cy.logStep('Submit form');
  cy.get('button[type="submit"]').click();
  
  cy.logStep('Verify login success');
  cy.get('[data-testid="dashboard"]').should('be.visible');
});
```

## Features Provided

✅ **Manual Step Logging**: `cy.logStep('description')`
✅ **Automatic Step Extraction**: From test code if not all steps logged
✅ **Screenshot Capture**: On test failure, stored as base64
✅ **Step Status Tracking**: PASS / FAIL / NOT_EXECUTED
✅ **Failed Step Handling**: Marks failing step + subsequent as NOT_EXECUTED
✅ **External Test Cases**: Support for unmatched test IDs
✅ **Inline Display**: Screenshots shown directly in UI without API calls

## Test Case ID Format

Required: Test title must include ID tag
```javascript
it('[XP-TC-1] Test name', () => { ... })     // ✅ Matched
it('[QA-TC-5] Another test', () => { ... })  // ✅ Matched
it('No ID test', () => { ... })              // ⚠️ External
```

## What Happens After Tests Run

1. Reporter processes Cypress/Mocha results
2. Extracts test case IDs from titles
3. Matches against QATM project test cases
4. For failed tests:
   - Captures screenshot
   - Marks failing step with error
   - Marks subsequent steps as NOT_EXECUTED with explanation
5. Extracts any unlogged steps from test code
6. Submits results to QATM API in single batch

## Dependencies

```json
{
  "devDependencies": {
    "cypress": "^latest",
    "mochawesome": "^7.1.3",
    "dotenv": "^16.0.0"
  }
}
```

## File Sizes for Reference

- cypress/support/e2e.js: **52 lines** (~25 without comments)
- scripts/cypress-automation-mocha.js: **502 lines** (includes detailed comments)
- cypress.config.js update: **~15 lines**
- .env.qatm: **~6 lines**
- Test file changes: Add ID tag + `cy.logStep()` calls

**Total for user's existing project: Less than 2 pages of code**

## For Users

Direct them to:
1. Sample project: `/Documents/sample_qa_testkit_mocha_cypress/`
2. Quick checklist: `QUICK_CHECKLIST.md` (5 minutes)
3. Full guide: `INTEGRATION_GUIDE.md` (reference)
4. Example test: `cypress/e2e/schoolManagement.spec.js`
