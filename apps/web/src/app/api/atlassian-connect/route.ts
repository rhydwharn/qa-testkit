export async function GET() {
  const baseUrl = (process.env.NEXTAUTH_URL ?? process.env.BASE_URL ?? '').replace(/\/$/, '');

  const descriptor = {
    name: 'QA Test Management',
    description: 'Enterprise test case and cycle management, fully integrated with JIRA.',
    key: 'com.qa-test-management.app',
    baseUrl,
    vendor: {
      name: 'QA Test Management',
      url: baseUrl,
    },
    authentication: { type: 'jwt' },
    lifecycle: {
      installed: '/api/jira/lifecycle/installed',
      uninstalled: '/api/jira/lifecycle/uninstalled',
    },
    scopes: ['READ', 'WRITE'],
    apiVersion: 1,
    enableLicensing: false,
    modules: {
      generalPages: [
        {
          key: 'test-management-nav',
          name: { value: 'QA Tests' },
          url: '/jira/app?cloudId={cloudId}&projectKey={project.key}',
          location: 'system.top.navigation.bar',
          weight: 200,
        },
      ],
      jiraProjectPages: [
        {
          key: 'test-management-project-page',
          name: { value: 'Test Management' },
          url: '/jira/project?cloudId={cloudId}&projectKey={project.key}',
          location: 'jira.project.sidebar.plugins.navigation',
          weight: 100,
        },
      ],
      webPanels: [
        {
          key: 'test-cases-issue-panel',
          name: { value: 'Test Cases' },
          url: '/jira/issue-panel?cloudId={cloudId}&issueKey={issue.key}&projectKey={project.key}',
          location: 'atl.jira.view.issue.right.context',
          layout: { width: '100%', height: '300px' },
          weight: 100,
        },
      ],
    },
  };

  return Response.json(descriptor, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
