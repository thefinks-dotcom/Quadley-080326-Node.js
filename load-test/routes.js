const ROUTE_MATRIX = [
  {
    name: "GET /api/auth/me",
    method: "GET",
    path: "/api/auth/me",
    category: "auth",
    description: "Auth check — mostly middleware cost",
  },
  {
    name: "GET /api/conversations",
    method: "GET",
    path: "/api/conversations",
    category: "read",
    description: "Read-heavy MongoDB query with tenant isolation",
  },
  {
    name: "GET /api/messages",
    method: "GET",
    path: "/api/messages",
    category: "read",
    description: "Read + tenant isolation lookup",
  },
  {
    name: "GET /api/announcements",
    method: "GET",
    path: "/api/announcements",
    category: "read",
    description: "Lightweight read",
  },
  {
    name: "GET /api/events",
    method: "GET",
    path: "/api/events",
    category: "read",
    description: "Moderate complexity read with date filtering",
  },
  {
    name: "POST /api/messages",
    method: "POST",
    path: "/api/messages",
    category: "write",
    description:
      "Write path — triggers AuditLogMiddleware + XSSSanitization + AI moderation flag check",
    body: JSON.stringify({
      content: "Load test message",
      receiver_id: "00000000-0000-0000-0000-000000000000",
    }),
  },
];

module.exports = { ROUTE_MATRIX };
