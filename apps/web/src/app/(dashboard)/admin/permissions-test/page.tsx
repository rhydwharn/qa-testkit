"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface TestResult {
  feature: string;
  role: string;
  result: "PASS" | "FAIL";
  message: string;
  timestamp: string;
}

export default function PermissionsTestPage() {
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState("TESTER");
  const [selectedFeature, setSelectedFeature] = useState("TEST_CASE_CREATE");
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const roles = ["OWNER", "LEAD", "TESTER", "VIEWER"];
  const features = [
    "TEST_CASE_CREATE",
    "TEST_CASE_READ",
    "TEST_CASE_UPDATE",
    "TEST_CASE_DELETE",
    "TEST_CYCLE_CREATE",
    "TEST_CYCLE_READ",
    "TEST_CYCLE_UPDATE",
    "TEST_CYCLE_DELETE",
    "TEST_CYCLE_EXECUTE",
    "TEST_PLAN_CREATE",
    "TEST_PLAN_READ",
    "TEST_PLAN_UPDATE",
    "TEST_PLAN_DELETE",
    "PROJECT_SETTINGS_MANAGE",
    "PROJECT_MEMBERS_MANAGE",
    "PROJECT_AUTOMATION_SUBMIT",
    "PROJECT_REPORTS_VIEW",
    "PROJECT_COMMENTS_CREATE",
    "PROJECT_FILTERS_MANAGE",
    "JIRA_INTEGRATION",
  ];

  const handleTestSingleFeature = async () => {
    if (!projectId) {
      console.error("Please select a project");
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/permissions/preview?role=${role}`);
      if (!response.ok) throw new Error("Failed to fetch permissions");

      const data = await response.json();
      const allowedFeatures = data.allowedFeatures.map((f: any) => f.featureName);
      const isAllowed = allowedFeatures.includes(selectedFeature);

      const newResult: TestResult = {
        feature: selectedFeature,
        role,
        result: isAllowed ? "PASS" : "FAIL",
        message: isAllowed
          ? `${selectedFeature} is allowed for ${role}`
          : `${selectedFeature} is not allowed for ${role}`,
        timestamp: new Date().toISOString(),
      };

      setTestResults((prev) => [newResult, ...prev]);
      console.log(newResult.message);
    } catch (error) {
      console.error("Error testing permission:", error);
      console.error("Failed to test permission");
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunAllTests = async () => {
    if (!projectId) {
      console.error("Please select a project");
      return;
    }

    setIsRunning(true);
    const results: TestResult[] = [];

    try {
      for (const testRole of roles) {
        const response = await fetch(
          `/api/projects/${projectId}/permissions/preview?role=${testRole}`
        );
        if (!response.ok) continue;

        const data = await response.json();
        const allowedFeatures = data.allowedFeatures.map((f: any) => f.featureName);

        for (const feature of features) {
          const isAllowed = allowedFeatures.includes(feature);
          results.push({
            feature,
            role: testRole,
            result: isAllowed ? "PASS" : "FAIL",
            message: isAllowed ? "Feature allowed" : "Feature denied",
            timestamp: new Date().toISOString(),
          });
        }
      }

      setTestResults(results);
      const passCount = results.filter((r) => r.result === "PASS").length;
      console.log(`Test complete: ${passCount}/${results.length} passed`);
    } catch (error) {
      console.error("Error running tests:", error);
      console.error("Failed to run tests");
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportResults = () => {
    const csv = [
      ["Feature", "Role", "Result", "Message", "Timestamp"],
      ...testResults.map((r) => [r.feature, r.role, r.result, r.message, r.timestamp]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permission-test-results-${Date.now()}.csv`;
    a.click();
  };

  const passCount = testResults.filter((r) => r.result === "PASS").length;
  const failCount = testResults.filter((r) => r.result === "FAIL").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Permission Testing Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Test and verify permission configurations for different roles and features
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Project ID
            </label>
            <input
              type="text"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              placeholder="Enter project ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Feature
          </label>
          <select
            value={selectedFeature}
            onChange={(e) => setSelectedFeature(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {features.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleTestSingleFeature} disabled={isRunning}>
            {isRunning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Test Single Feature
          </Button>
          <Button onClick={handleRunAllTests} disabled={isRunning} variant="secondary">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Run All Tests ({roles.length} roles × {features.length} features)
          </Button>
          {testResults.length > 0 && (
            <Button onClick={handleExportResults} variant="outline">
              Export Results (CSV)
            </Button>
          )}
        </div>
      </div>

      {testResults.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Test Results Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="text-sm text-green-600 font-medium">Passed</div>
                <div className="text-2xl font-bold text-green-700 mt-1">{passCount}</div>
              </div>
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-sm text-red-600 font-medium">Failed</div>
                <div className="text-2xl font-bold text-red-700 mt-1">{failCount}</div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-600 font-medium">Total</div>
                <div className="text-2xl font-bold text-blue-700 mt-1">{testResults.length}</div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold text-sm">Feature</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Role</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Result</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Message</th>
                  <th className="text-left py-3 px-4 font-semibold text-sm">Time</th>
                </tr>
              </thead>
              <tbody>
                {testResults.slice(0, 50).map((result, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium">{result.feature}</td>
                    <td className="py-3 px-4 text-sm">{result.role}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {result.result === "PASS" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span
                          className={
                            result.result === "PASS"
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {result.result}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{result.message}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(result.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {testResults.length > 50 && (
            <p className="text-sm text-gray-500 mt-4">
              Showing 50 of {testResults.length} results. Export to see all.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
