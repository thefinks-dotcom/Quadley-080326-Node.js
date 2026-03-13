const fs = require("fs");
const path = require("path");

function formatLatency(ms) {
  return ms.toFixed(2);
}

function printResultsTable(results) {
  console.log("\n" + "=".repeat(110));
  console.log("  LOAD TEST RESULTS");
  console.log("=".repeat(110));

  const header = [
    padRight("Route", 30),
    padLeft("Avg (ms)", 12),
    padLeft("P95 (ms)", 12),
    padLeft("P99 (ms)", 12),
    padLeft("Req/sec", 12),
    padLeft("Errors", 8),
    padLeft("Non-2xx", 8),
  ].join(" | ");

  console.log(header);
  console.log("-".repeat(110));

  for (const r of results) {
    const row = [
      padRight(r.route, 30),
      padLeft(formatLatency(r.avgLatency), 12),
      padLeft(formatLatency(r.p95Latency), 12),
      padLeft(formatLatency(r.p99Latency), 12),
      padLeft(r.requestsPerSec.toFixed(1), 12),
      padLeft(String(r.errors), 8),
      padLeft(String(r.non2xx || 0), 8),
    ].join(" | ");
    console.log(row);
  }

  console.log("=".repeat(110));
}

function writeResultsJson(results) {
  const outputPath = path.join(__dirname, "results.json");
  const output = {
    timestamp: new Date().toISOString(),
    summary: results.map((r) => ({
      route: r.route,
      method: r.method,
      category: r.category,
      avgLatencyMs: parseFloat(formatLatency(r.avgLatency)),
      p95LatencyMs: parseFloat(formatLatency(r.p95Latency)),
      p99LatencyMs: parseFloat(formatLatency(r.p99Latency)),
      requestsPerSec: parseFloat(r.requestsPerSec.toFixed(1)),
      totalRequests: r.totalRequests,
      errors: r.errors,
      non2xx: r.non2xx || 0,
      statusCodes: r.statusCodes || {},
      timeouts: r.timeouts,
      duration: r.duration,
      connections: r.connections,
      raw: r.raw || null,
    })),
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n📄 Raw results written to ${outputPath}`);
}

function isReliableResult(r) {
  if (r.totalRequests === 0 || r.errors === -1) return false;
  const non2xxRate = (r.non2xx || 0) / Math.max(r.totalRequests, 1);
  return non2xxRate < 0.5;
}

function printBottleneckAnalysis(results) {
  console.log("\n" + "=".repeat(110));
  console.log("  BOTTLENECK ANALYSIS");
  console.log("=".repeat(110));

  if (results.length === 0) {
    console.log("  No results to analyze.\n");
    return;
  }

  const unreliable = results.filter((r) => !isReliableResult(r));
  if (unreliable.length > 0) {
    console.log("\n⚠️  Routes with high non-2xx rate (excluded from latency analysis):");
    for (const r of unreliable) {
      const non2xxPct =
        r.totalRequests > 0
          ? (((r.non2xx || 0) / r.totalRequests) * 100).toFixed(1)
          : "N/A";
      const codes = Object.entries(r.statusCodes || {})
        .map(([code, info]) => `${code}: ${info.count || info}`)
        .join(", ");
      console.log(
        `   • ${r.route}: ${non2xxPct}% non-2xx (${r.non2xx || 0}/${r.totalRequests})${codes ? " [" + codes + "]" : ""}`
      );
    }
    console.log(
      "   → Latency numbers for these routes may not reflect real business logic performance."
    );
  }

  const reliable = results.filter(isReliableResult);

  if (reliable.length === 0) {
    console.log("\n  ❌ No routes returned reliable (>50% success) results.");
    console.log("     Cannot perform bottleneck analysis.");
    console.log(
      "     Check that the backend is running and test credentials are valid.\n"
    );
    return;
  }

  const authWriteRoutes = reliable.filter(
    (r) => r.category === "auth" || r.category === "write"
  );
  const readRoutes = reliable.filter((r) => r.category === "read");

  const avgP99All =
    reliable.reduce((sum, r) => sum + r.p99Latency, 0) / reliable.length;
  const avgP99AuthWrite =
    authWriteRoutes.length > 0
      ? authWriteRoutes.reduce((sum, r) => sum + r.p99Latency, 0) /
        authWriteRoutes.length
      : 0;
  const avgP99Read =
    readRoutes.length > 0
      ? readRoutes.reduce((sum, r) => sum + r.p99Latency, 0) /
        readRoutes.length
      : 0;

  const slowest = [...reliable].sort((a, b) => b.p99Latency - a.p99Latency);
  const fastest = [...reliable].sort((a, b) => a.p99Latency - b.p99Latency);

  console.log("\n📊 Slowest routes (by P99 latency):");
  for (const r of slowest.slice(0, 3)) {
    console.log(
      `   ${r.route} — P99: ${formatLatency(r.p99Latency)}ms  (${r.description})`
    );
  }

  console.log("\n📊 Fastest routes (by P99 latency):");
  for (const r of fastest.slice(0, 3)) {
    console.log(
      `   ${r.route} — P99: ${formatLatency(r.p99Latency)}ms  (${r.description})`
    );
  }

  const p99Spread =
    slowest[0] && fastest[0]
      ? slowest[0].p99Latency / Math.max(fastest[0].p99Latency, 1)
      : 1;

  console.log("\n🔍 Diagnosis:");

  if (p99Spread < 1.5) {
    console.log(
      "   ⚠️  All routes have similar latency (spread < 1.5x)."
    );
    console.log(
      "   → The bottleneck is likely in shared middleware layers:"
    );
    console.log(
      "     • Rate limiter (slowapi) applied globally"
    );
    console.log(
      "     • CORS middleware processing on every request"
    );
    console.log(
      "     • SecurityHeadersMiddleware adding headers on every response"
    );
    console.log(
      "     • Or: MongoDB connection pool saturation under 20 concurrent connections"
    );
  } else if (
    avgP99AuthWrite > 0 &&
    avgP99Read > 0 &&
    avgP99AuthWrite > avgP99Read * 1.5
  ) {
    console.log(
      "   ⚠️  Auth/write routes are significantly slower than read routes."
    );
    console.log(
      `   → Auth/write avg P99: ${formatLatency(avgP99AuthWrite)}ms vs Read avg P99: ${formatLatency(avgP99Read)}ms`
    );
    console.log(
      "   → Likely bottleneck: middleware stack on mutating requests:"
    );
    console.log(
      "     • AuditLogMiddleware runs on all POST/PUT/DELETE and /api/auth/* routes"
    );
    console.log(
      "     • XSSSanitizationMiddleware parses and sanitizes JSON body on POST/PUT/PATCH"
    );
    console.log(
      "     • POST /messages also triggers AI moderation check (external HTTP call)"
    );
    console.log(
      "     • bcrypt password hashing on login (intentionally slow, ~100ms per hash)"
    );
  } else if (
    avgP99Read > 0 &&
    avgP99AuthWrite > 0 &&
    avgP99Read > avgP99AuthWrite * 1.5
  ) {
    console.log(
      "   ⚠️  Read routes are significantly slower than auth/write routes."
    );
    console.log(
      `   → Read avg P99: ${formatLatency(avgP99Read)}ms vs Auth/write avg P99: ${formatLatency(avgP99AuthWrite)}ms`
    );
    console.log(
      "   → Likely bottleneck: MongoDB query patterns or tenant DB resolution:"
    );
    console.log(
      "     • get_tenant_db_for_user dependency runs on every tenant-scoped route"
    );
    console.log(
      "     • GET /conversations does N+1 queries (user lookups per conversation)"
    );
    console.log(
      "     • GET /messages fetches up to 100 documents with $or filter"
    );
    console.log(
      "     • Missing or inefficient indexes on tenant databases"
    );
  } else {
    console.log(
      "   ℹ️  No single dominant bottleneck pattern detected."
    );
    console.log(
      "   → Performance is mixed across route categories."
    );
    console.log(
      "   → Review individual route P99 values above for targeted optimization."
    );
  }

  const heavyReadRoutes = readRoutes.filter(
    (r) => r.p99Latency > avgP99All * 1.5
  );
  if (heavyReadRoutes.length > 0) {
    console.log("\n   📌 Specific read routes with high P99 (>1.5x average):");
    for (const r of heavyReadRoutes) {
      console.log(
        `      • ${r.route}: ${formatLatency(r.p99Latency)}ms — ${r.description}`
      );
    }
  }

  const errorRoutes = reliable.filter((r) => r.errors > 0);
  if (errorRoutes.length > 0) {
    console.log("\n   🚨 Routes with transport errors:");
    for (const r of errorRoutes) {
      console.log(
        `      • ${r.route}: ${r.errors} errors out of ${r.totalRequests} requests`
      );
    }
  }

  console.log("\n" + "=".repeat(110) + "\n");
}

function padRight(str, len) {
  return str.length >= len ? str.substring(0, len) : str + " ".repeat(len - str.length);
}

function padLeft(str, len) {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

module.exports = { printResultsTable, writeResultsJson, printBottleneckAnalysis };
