import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m',  target: 30 },
    { duration: '2m',  target: 50 },
    { duration: '1m',  target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  
  // Scenario 1: Homepage
  const homeRes = http.get(`${BASE_URL}/`);
  check(homeRes, {
    'Homepage returns 200': (r) => r.status === 200,
    'Homepage loads fast': (r) => r.timings.duration < 1000,
  });
  sleep(1);

  // Scenario 2: Login Page
  const loginRes = http.get(`${BASE_URL}/login`);
  check(loginRes, {
    'Login page loads': (r) => r.status === 200,
  });
  sleep(1);

  // Scenario 3: Important API Route (update this URL as needed)
  const apiRes = http.get(`${BASE_URL}/api/books`);
  check(apiRes, {
    'API responds successfully': (r) => r.status === 200,
  });
  sleep(1);
}
