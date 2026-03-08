/** @type {import('next').NextConfig} */

const isExport = process.env.NEXT_EXPORT === 'true';

const securityHeaders = [
  { key: 'X-Content-Type-Options',             value: 'nosniff' },
  { key: 'X-Frame-Options',                    value: 'DENY' },
  { key: 'X-XSS-Protection',                  value: '1; mode=block' },
  { key: 'Strict-Transport-Security',          value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'Referrer-Policy',                    value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',                 value: 'geolocation=(), microphone=(), camera=()' },
  { key: 'X-Permitted-Cross-Domain-Policies',  value: 'none' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
      "connect-src 'self' https: http://localhost:8000",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig = {
  // Static export for Capacitor iOS builds
  ...(isExport ? { output: 'export', distDir: 'out' } : {}),

  // Allow Replit preview URLs and localhost variants as dev origins for HMR
  allowedDevOrigins: ['*.replit.dev', '*.picard.replit.dev', '127.0.0.1'],

  // Proxy /api/* to FastAPI backend in all environments
  async rewrites() {
    if (isExport) return [];
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },

  async headers() {
    if (isExport) return [];
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
