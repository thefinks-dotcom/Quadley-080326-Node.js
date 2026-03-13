const BASE_URL = process.env.LOAD_TEST_BASE_URL || "http://localhost:5000";
const TEST_EMAIL = process.env.LOAD_TEST_EMAIL || "test@example.com";
const TEST_PASSWORD = process.env.LOAD_TEST_PASSWORD || "TestPassword123!";
const CONNECTIONS = parseInt(process.env.LOAD_TEST_CONNECTIONS || "20", 10);
const DURATION = parseInt(process.env.LOAD_TEST_DURATION || "30", 10);

module.exports = {
  BASE_URL,
  TEST_EMAIL,
  TEST_PASSWORD,
  CONNECTIONS,
  DURATION,
};
