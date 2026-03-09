const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy /api requests to the backend server
  // Mounting at root (not '/api') preserves the full path including /api prefix
  app.use(createProxyMiddleware({
    target: 'http://localhost:8000',
    changeOrigin: true,
    pathFilter: '/api',
  }));

  // Add security headers to ALL responses from the dev server
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com data:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ') + ';');
    next();
  });
};
