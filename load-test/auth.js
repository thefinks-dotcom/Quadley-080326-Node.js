const { BASE_URL, TEST_EMAIL, TEST_PASSWORD } = require("./config");

async function authenticate() {
  const url = `${BASE_URL}/api/auth/login`;

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
  } catch (err) {
    console.error(`\n❌ Failed to connect to ${url}`);
    console.error(`   Ensure the backend is running on ${BASE_URL}`);
    console.error(`   Error: ${err.message}\n`);
    process.exit(1);
  }

  if (!response.ok) {
    const body = await response.text();
    console.error(`\n❌ Login failed (HTTP ${response.status})`);
    console.error(`   URL: ${url}`);
    console.error(`   Email: ${TEST_EMAIL}`);
    console.error(`   Response: ${body}\n`);
    process.exit(1);
  }

  const data = await response.json();
  const token = data.access_token;

  if (!token) {
    console.error("\n❌ Login response did not contain an access_token.");
    console.error(`   Response keys: ${Object.keys(data).join(", ")}\n`);
    process.exit(1);
  }

  console.log(`✅ Authenticated as ${TEST_EMAIL}`);
  return token;
}

module.exports = { authenticate };
