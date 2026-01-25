const http = require('http');

const endpoints = [
  { path: '/api/auth/profile', method: 'GET', expectedStatus: 401 }, // Auth required
  { path: '/api/history/chat', method: 'GET', expectedStatus: 401 }, // Auth required
  { path: '/api/image/analyze', method: 'POST', expectedStatus: 404 }, // Should be 401 or 400 depending on middleware, but definitely NOT 404 if mounted. Wait, image routes require auth? Yes.
  // Actually, let's just check if they are NOT 404. 404 means "Endpoint not found" from the server.js catch-all.
  // Anything else means the route is mounted.
];

function testEndpoint(endpoint) {
  const options = {
    hostname: 'localhost',
    port: 3000,
    path: endpoint.path,
    method: endpoint.method,
    headers: {
        'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    console.log(`[${endpoint.method}] ${endpoint.path} => Status: ${res.statusCode}`);
    if (res.statusCode === 404) {
        console.error(`FAIL: ${endpoint.path} not found!`);
        process.exit(1);
    } else {
        console.log(`PASS: ${endpoint.path} is reachable.`);
    }
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    // If server is not running, we can't test.
    // We assume server is running (User needs to restart it though).
    // If I cannot connect, I cannot verify.
  });

  req.end();
}

console.log("Verifying endpoints...");
endpoints.forEach(testEndpoint);
