import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/admin/signed-url.js';

const ENQUIRY_ID = 'd0a0d6c7-7ce4-4a8b-9bd0-cb7c5f310001';
const FILE_ID = 'a0d0d6c7-7ce4-4a8b-9bd0-cb7c5f310002';
const FILE_PATH = `enquiries/${ENQUIRY_ID}/${FILE_ID}-brief.pdf`;
const ATTACHMENT = { path: FILE_PATH, name: 'brief.pdf', size: 1200, type: 'application/pdf' };
const OWNER = { id: 'owner-uuid', email: 'jessenyarko192@gmail.com' };
const SERVICE_KEY = 'test-only-service-role-placeholder';
const ACCESS_TOKEN = 'test-owner-access-token';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

function mockBackend(t, options = {}) {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const calls = [];
  process.env.SUPABASE_URL = 'https://jas-test.supabase.co';
  process.env.SUPABASE_SECRET_KEY = SERVICE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });

    if (url.pathname === '/auth/v1/user') {
      if (options.authFailure) return json({ message: 'Invalid token' }, 401);
      return json(options.user || OWNER);
    }
    if (url.pathname === '/rest/v1/enquiries') {
      if (options.queryFailure) return json({ message: 'Database unavailable' }, 500);
      const row = options.enquiry === undefined
        ? { id: ENQUIRY_ID, file_paths: [ATTACHMENT] }
        : options.enquiry;
      return json(row ? [row] : []);
    }
    if (url.pathname.includes('/storage/v1/object/sign/')) {
      if (options.signFailure) return json({ message: 'File unavailable' }, 404);
      return json({ signedURL: '/object/sign/private?token=short-lived-test-token' });
    }
    throw new Error(`Unexpected mocked Supabase request: ${url.pathname}`);
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
    for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });
  return calls;
}

async function invoke({ method = 'POST', authorization = `Bearer ${ACCESS_TOKEN}`, body = { path: FILE_PATH }, contentLength } = {}) {
  const serialized = typeof body === 'string' ? body : JSON.stringify(body);
  const req = {
    method,
    headers: {
      authorization,
      'content-type': 'application/json',
      'content-length': String(contentLength ?? Buffer.byteLength(serialized))
    },
    body: serialized
  };
  const result = { headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(data) { result.body = data; return this; }
  };
  await handler(req, res);
  return result;
}

test('signed-url endpoint accepts POST only and rejects missing authentication', async t => {
  const calls = mockBackend(t);
  const getResult = await invoke({ method: 'GET' });
  assert.equal(getResult.status, 405);
  assert.equal(getResult.headers.Allow, 'POST');
  assert.equal(getResult.headers['Cache-Control'], 'no-store');

  const missingAuth = await invoke({ authorization: '' });
  assert.equal(missingAuth.status, 401);
  assert.equal(calls.length, 0);
});

test('signed-url endpoint rejects malformed bodies and paths before contacting Supabase', async t => {
  const calls = mockBackend(t);
  for (const body of ['{broken', null, [], {}, { path: `../${FILE_PATH}` }, { path: FILE_PATH, extra: 'ignored' }]) {
    const result = await invoke({ body });
    assert.equal(result.status, 400);
  }
  assert.equal((await invoke({ body: { path: FILE_PATH }, contentLength: 5000 })).status, 400);
  assert.equal(calls.length, 0);
});

test('signed-url endpoint verifies identity and refuses non-owner accounts', async t => {
  const invalidTokenCalls = mockBackend(t, { authFailure: true });
  const invalidToken = await invoke();
  assert.equal(invalidToken.status, 401);
  assert.equal(invalidTokenCalls.length, 1);
  assert.equal(invalidTokenCalls[0].init.headers.Authorization, `Bearer ${ACCESS_TOKEN}`);

  const nonOwnerCalls = mockBackend(t, { user: { id: 'other-user', email: 'other@example.com' } });
  const nonOwner = await invoke();
  assert.equal(nonOwner.status, 403);
  assert.equal(nonOwnerCalls.length, 1);
  assert.ok(!nonOwnerCalls.some(call => call.url.pathname.includes('/storage/v1/object/sign/')));
});

test('signed-url endpoint only signs paths still listed on the referenced enquiry', async t => {
  const calls = mockBackend(t, {
    enquiry: { id: ENQUIRY_ID, file_paths: [{ ...ATTACHMENT, path: 'enquiries/another-file.pdf' }] }
  });
  const result = await invoke();
  assert.equal(result.status, 404);
  assert.ok(calls.some(call => call.url.pathname === '/rest/v1/enquiries'));
  assert.ok(!calls.some(call => call.url.pathname.includes('/storage/v1/object/sign/')));
});

test('signed-url endpoint creates a private 60-second download only after owner verification', async t => {
  const calls = mockBackend(t);
  const result = await invoke();

  assert.equal(result.status, 200);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.deepEqual(result.body, {
    url: 'https://jas-test.supabase.co/storage/v1/object/sign/private?token=short-lived-test-token&download=brief.pdf'
  });
  assert.ok(calls.findIndex(call => call.url.pathname === '/auth/v1/user') < calls.findIndex(call => call.url.pathname === '/rest/v1/enquiries'));
  assert.ok(calls.findIndex(call => call.url.pathname === '/rest/v1/enquiries') < calls.findIndex(call => call.url.pathname.includes('/storage/v1/object/sign/')));

  const storageRequest = calls.find(call => call.url.pathname.includes('/storage/v1/object/sign/'));
  const signOptions = JSON.parse(storageRequest.init.body);
  assert.equal(signOptions.expiresIn, 60);
  assert.equal(new URL(result.body.url).searchParams.get('download'), 'brief.pdf');
  assert.ok(!JSON.stringify(result.body).includes(SERVICE_KEY));
});

test('signed-url endpoint reports missing configuration, database, and storage errors safely', async t => {
  const originalEnv = { ...process.env };
  process.env.SUPABASE_URL = 'https://jas-test.supabase.co';
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingConfig = await invoke();
  assert.equal(missingConfig.status, 500);

  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }

  const databaseCalls = mockBackend(t, { queryFailure: true });
  const databaseFailure = await invoke();
  assert.equal(databaseFailure.status, 500);
  assert.ok(!databaseFailure.body.error.includes(SERVICE_KEY));
  assert.ok(databaseCalls.some(call => call.url.pathname === '/rest/v1/enquiries'));

  const storageCalls = mockBackend(t, { signFailure: true });
  const storageFailure = await invoke();
  assert.equal(storageFailure.status, 404);
  assert.ok(!storageCalls.some(call => call.url.href.includes('token=')));
});
