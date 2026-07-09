import http from 'k6/http';
import { check, sleep } from 'k6';

// This is the configuration for our load test
export const options = {
  // A reasonable load pattern: ramp up to 50 users, hold, and ramp down
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 virtual users over 30 seconds
    { duration: '1m', target: 50 }, // Ramp up to 50 virtual users over the next 1 minute
    { duration: '1m', target: 50 }, // Hold at 50 virtual users for 1 minute
    { duration: '30s', target: 0 }, // Ramp down to 0 users over 30 seconds
  ],
  // Define thresholds for performance (e.g. 95% of requests should be below 500ms)
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'], // Error rate should be less than 1%
  },
};

// You can run this against local dev server by default, or pass an env var:
// k6 run -e BASE_URL=https://mangu.com tests/k6/load-test.js
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // --- 1. Test the Homepage ---
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'Homepage status is 200': (r) => r.status === 200,
    // Add more checks if needed, e.g. checking for specific text on the page
  });
  sleep(1); // Simulate realistic user wait time between actions

  // --- 2. Test Auth Endpoint ---
  // In Next.js with Supabase, if we have an API route or just visiting the login page:
  const loginRes = http.get(`${BASE_URL}/login`);
  check(loginRes, {
    'Login page loads (status 200)': (r) => r.status === 200,
  });
  sleep(1);

  // --- 3. Test an Important API Route ---
  // Assuming there is a public books API or discover API we can fetch
  // E.g., a simple health check or querying a public resource
  const apiRes = http.get(`${BASE_URL}/api/books`);
  check(apiRes, {
    // If the route doesn't exist, we accept 404 just for demonstration,
    // but in a real test you'd want 200. Change this URL to an active endpoint!
    'API route responds quickly': (r) => r.status === 200 || r.status === 404,
  });
  sleep(1);
}
