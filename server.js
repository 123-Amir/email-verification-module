'use strict';

const http = require('http');
const url = require('url');
const { verifyEmail, getDidYouMean, validateSyntax } = require('./emailVerifier');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  try {
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        service: 'Email Verification API',
        version: '1.0.0',
        endpoints: {
          'GET /': 'API info',
          'GET /verify?email=user@example.com': 'Verify email address',
          'GET /typo?email=user@gmial.com': 'Check for typo suggestions',
          'GET /syntax?email=test@example.com': 'Validate email syntax only',
        },
      }, null, 2));
      return;
    }

    if (pathname === '/verify' && req.method === 'GET') {
      const email = query.email;
      if (!email) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing "email" query parameter' }));
        return;
      }
      const result = await verifyEmail(email);
      res.writeHead(200);
      res.end(JSON.stringify(result, null, 2));
      return;
    }

    if (pathname === '/typo' && req.method === 'GET') {
      const email = query.email;
      if (!email) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing "email" query parameter' }));
        return;
      }
      const suggestion = getDidYouMean(email);
      res.writeHead(200);
      res.end(JSON.stringify({ email, suggestion, hasSuggestion: suggestion !== null }, null, 2));
      return;
    }

    if (pathname === '/syntax' && req.method === 'GET') {
      const email = query.email;
      if (!email) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing "email" query parameter' }));
        return;
      }
      const error = validateSyntax(email);
      res.writeHead(200);
      res.end(JSON.stringify({ email, isValid: error === null, error }, null, 2));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log('\nEmail Verification API Server Started!\n');
  console.log('Base URL: http://localhost:' + PORT + '\n');
  console.log('Available Endpoints:\n');
  console.log('  GET http://localhost:' + PORT + '/');
  console.log('    - Shows API info\n');
  console.log('  GET http://localhost:' + PORT + '/verify?email=user@example.com');
  console.log('    - Full email verification (SMTP check, MX lookup)\n');
  console.log('  GET http://localhost:' + PORT + '/typo?email=user@gmial.com');
  console.log('    - Typo detection (Levenshtein distance <= 2)\n');
  console.log('  GET http://localhost:' + PORT + '/syntax?email=test@example.com');
  console.log('    - Syntax validation only (no network calls)\n');
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
