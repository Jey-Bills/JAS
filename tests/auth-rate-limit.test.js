import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import handler from '../api/auth/check-rate-limit.js';

const SERVICE_KEY = 'test-only-rate-limit-secret-placeholder';

function mockSupabase(t, rpcResponse = [{ allowed: true, retry_after: 0 }], status = 200) {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const originalEnv = { ...process.env };
  const calls = [];
  const logs = [];
  process.env.SUPABASE_URL = 'https://jas-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = SERVICE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.error = line => logs.push(String(line));

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname === '/rest/v1/rpc/consume_auth_login_rate_limit') {
      return new Response(JSON.stringify(rpcResponse), {
        status,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    process.env = originalEnv;
  });
  return { calls, logs };
}

function invoke({ method = 'POST', body = { email: 'Owner@Example.com' }, headers = {} } = {}) {
  const result = { headers: {} };
  const req = {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.17, 10.0.0.1', ...headers },
    body
  };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return this; },
    json(payload) { result.body = payload; return this; }
  };
  return handler(req, res).then(() => result);
}

test('login rate-limit endpoint accepts POST only', async t => {
  const { calls } = mockSupabase(t);
  const result = await invoke({ method: 'GET' });
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(calls.length, 0);
});

test('invalid bodies and email addresses are rejected before database access', async t => {
  const { calls } = mockSupabase(t);
  for (const body of [null, [], {}, '{bad', { email: 'not-an-email' }, { email: 'a@example.com', extra: true }]) {
    const result = await invoke({ body });
    assert.equal(result.status, 400);
  }
  assert.equal(calls.length, 0);
});

test('endpoint hashes normalized email and client IP, and sends only the hash to Supabase', async t => {
  const { calls, logs } = mockSupabase(t);
  const result = await invoke();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { allowed: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/consume_auth_login_rate_limit');
  const hash = JSON.parse(calls[0].init.body).p_identifier_hash;
  const expected = crypto.createHash('sha256').update('owner@example.com\n203.0.113.17').digest('hex');
  assert.equal(hash, expected);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.ok(!calls[0].init.body.includes('owner@example.com'));
  assert.ok(!calls[0].init.body.includes('203.0.113.17'));
  assert.equal(logs.length, 0);
});

test('blocked login attempts return a generic lockout without calling Supabase Auth', async t => {
  const { calls } = mockSupabase(t, [{ allowed: false, retry_after: 271 }]);
  const result = await invoke();
  assert.equal(result.status, 429);
  assert.equal(result.headers['Retry-After'], '271');
  assert.equal(result.body.allowed, false);
  assert.equal(result.body.retryAfter, 271);
  assert.doesNotMatch(JSON.stringify(result.body), /owner@example\.com|203\.0\.113\.17|identifier_hash/i);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.pathname.endsWith('/rpc/consume_auth_login_rate_limit'));
});

test('rate-limit database errors fail closed with a safe response and structured log', async t => {
  const { logs } = mockSupabase(t, { message: 'Database error with internal details' }, 500);
  const result = await invoke();
  assert.equal(result.status, 503);
  assert.match(result.body.error, /temporarily unavailable/i);
  assert.doesNotMatch(result.body.error, /Database|internal details/i);
  assert.equal(logs.length, 1);
  const log = JSON.parse(logs[0]);
  assert.equal(log.endpoint, 'auth/check-rate-limit');
  assert.equal(log.error, 'rate_limit_database_check_failed');
  assert.ok(log.timestamp);
  assert.ok(log.request_id);
});

test('missing server credentials fail closed without reaching Supabase', async t => {
  const originalEnv = { ...process.env };
  const originalConsoleError = console.error;
  const logs = [];
  console.error = line => logs.push(String(line));
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  t.after(() => {
    process.env = originalEnv;
    console.error = originalConsoleError;
  });

  const result = await invoke();
  assert.equal(result.status, 503);
  assert.match(result.body.error, /temporarily unavailable/i);
  assert.equal(logs.length, 1);
});
