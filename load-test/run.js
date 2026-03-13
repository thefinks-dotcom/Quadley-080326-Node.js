const autocannon = require("autocannon");
const { authenticate } = require("./auth");
const { ROUTE_MATRIX } = require("./routes");
const { BASE_URL, CONNECTIONS, DURATION } = require("./config");
const {
  printResultsTable,
  writeResultsJson,
  printBottleneckAnalysis,
} = require("./reporter");

async function runRouteTest(route, token) {
  const opts = {
    url: `${BASE_URL}${route.path}`,
    connections: CONNECTIONS,
    duration: DURATION,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (route.method === "POST" && route.body) {
    opts.method = "POST";
    opts.body = route.body;
  }

  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });

    autocannon.track(instance, { renderProgressBar: false });

    instance.on("tick", () => {
      process.stdout.write(".");
    });
  });
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║        Quadley API — Load & Performance Test        ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  Target:       ${BASE_URL}`);
  console.log(`  Connections:  ${CONNECTIONS}`);
  console.log(`  Duration:     ${DURATION}s per route`);
  console.log(`  Routes:       ${ROUTE_MATRIX.length}`);
  console.log();

  const token = await authenticate();
  console.log();

  const results = [];

  for (const route of ROUTE_MATRIX) {
    console.log(`🔄 Testing: ${route.name} (${route.description})`);
    try {
      const raw = await runRouteTest(route, token);

      const non2xx = raw.non2xx || 0;
      const statusCodes = raw.statusCodeStats || {};

      results.push({
        route: route.name,
        method: route.method,
        category: route.category,
        description: route.description,
        avgLatency: raw.latency.average,
        p95Latency: raw.latency.p95 || 0,
        p99Latency: raw.latency.p99 || 0,
        requestsPerSec: raw.requests.average,
        totalRequests: raw.requests.total,
        errors: raw.errors,
        non2xx: non2xx,
        statusCodes: statusCodes,
        timeouts: raw.timeouts,
        duration: DURATION,
        connections: CONNECTIONS,
        raw: {
          latency: raw.latency,
          requests: raw.requests,
          throughput: raw.throughput,
        },
      });

      const warnNon2xx = non2xx > 0 ? ` | Non-2xx: ${non2xx}` : "";
      console.log(
        `   ✅ Done — Avg: ${raw.latency.average.toFixed(2)}ms | ` +
          `P99: ${(raw.latency.p99 || 0).toFixed(2)}ms | ` +
          `RPS: ${raw.requests.average.toFixed(1)}${warnNon2xx}\n`
      );
    } catch (err) {
      console.error(`   ❌ Error testing ${route.name}: ${err.message}\n`);
      results.push({
        route: route.name,
        method: route.method,
        category: route.category,
        description: route.description,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        requestsPerSec: 0,
        totalRequests: 0,
        errors: -1,
        non2xx: 0,
        statusCodes: {},
        timeouts: 0,
        duration: DURATION,
        connections: CONNECTIONS,
      });
    }
  }

  printResultsTable(results);
  writeResultsJson(results);
  printBottleneckAnalysis(results);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
