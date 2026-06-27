/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.atlassian.net' },
      { protocol: 'https', hostname: 'secure.gravatar.com' },
    ],
  },

  async rewrites() {
    return [
      // Serve the Atlassian Connect descriptor at the conventional root path
      {
        source: '/atlassian-connect.json',
        destination: '/api/atlassian-connect',
      },
    ];
  },

  async headers() {
    return [
      {
        // JIRA embeds these pages inside an iframe — allow it via CSP frame-ancestors
        source: '/jira/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' https://*.atlassian.net https://*.jira.com https://*.atlassian.com",
          },
        ],
      },
      {
        // Descriptor must be publicly reachable with no CORS block
        source: '/api/atlassian-connect',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/api/jira/lifecycle/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
