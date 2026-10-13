import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import handler, { config } from '../api/submit.js';

const valid = {
  name: 'Phase 9 Test', email: 'client@example.com', phone: '0534423173',
  level: 'BSc', service: 'Editing & Formatting', description: 'Please review my academic document formatting.',
  deadline: '2026-12-01', existing_draft: 'Yes', preferred_contact: 'Email', consent: true, website: ''
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' }
});

function mockBackend(t, failures = {}) {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };
  const logs = [];
  const warn = console.warn;
  const error = console.error;
  console.warn = console.error = (...args) => logs.push(args.join(' '));
  process.env.SUPABASE_URL = 'https://project.example.invalid';
  process.env.SUPABASE_SECRET_KEY = 'test-secret-placeholder';
  process.env.RESEND_API_KEY = 'test-email-placeholder';
  let id;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    url = String(url);
    const call = { url, ...options };
    calls.push(call);
    if (url.includes('/rpc/consume_enquiry_rate_limit')) {
      return json([{ allowed: !failures.rateLimit, retry_after: 60 }]);
    }
    if (url.includes('/rest/v1/enquiries') && options.method === 'POST') {
      if (failures.insert) return json({ message: 'Insert unavailable' }, 500);
      const row = JSON.parse(options.body)[0];
      id = row.id;
      return json({ id });
    }
    if (url.includes('/rest/v1/enquiries') && options.method === 'PATCH') {
      if (failures.metadata) return json({ message: 'Update unavailable' }, 500);
      return json({ id });
    }
    if (url.includes('/object/sign/')) {
      if (failures.sign) return json({ message: 'Signing unavailable' }, 400);
      return json({ signedURL: '/object/sign/enquiry-files/test.pdf?token=TEST_TOKEN_NOT_SECRET&test=1' });
    }
    if (url.includes('/storage/v1/object/') && options.method === 'POST') {
      if (failures.upload || (failures.oneUpload && url.endsWith('.png'))) {
        return json({ message: 'Upload unavailable' }, 400);
      }
      return json({ Key: 'enquiry-files/test', Id: 'test-file-id' });
    }
    if (url.includes('/storage/v1/object/') && options.method === 'DELETE') {
      return json([]);
    }
    if (url === 'https://api.resend.com/emails') {
      if (failures.email) return json({ message: 'Email unavailable' }, 400);
      return json({ id: 'test-email-id' });
    }
    throw new Error('Unexpected mock request: ' + url);
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
    console.warn = warn;
    console.error = error;
    for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });
  return { calls, logs };
}

async function multipart(files = [], fields = valid) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, String(value)));
  for (const file of files) {
    form.append(file.field || 'files', new Blob([file.bytes || new Uint8Array(file.size ?? 10)], {
      type: file.type || 'application/pdf'
    }), file.name || 'brief.pdf');
  }
  const request = new Request('https://request.example.invalid', { method: 'POST', body: form });
  return { bytes: Buffer.from(await request.arrayBuffer()), contentType: request.headers.get('content-type') };
}

async function invoke({ bytes = Buffer.from(JSON.stringify(valid)), contentType = 'application/json', method = 'POST', body, length } = {}) {
  // Simulate the raw Node IncomingMessage stream used by Vercel with bodyParser:false.
  const req = Readable.from([bytes.subarray(0, 10), bytes.subarray(10)]);
  req.method = method;
  req.headers = { 'content-type': contentType, 'x-forwarded-for': '192.0.2.1', 'content-length': String(length ?? bytes.length) };
  if (body !== undefined) req.body = body;
  const result = { headers: {} };
  const res = {
    setHeader(key, value) { result.headers[key] = value; },
    status(code) { result.status = code; return this; },
    json(data) { result.body = data; return this; }
  };
  await handler(req, res);
  return result;
}

const uploads = calls => calls.filter(call => call.url.includes('/storage/v1/object/') && !call.url.includes('/sign/') && call.method === 'POST');
const insert = calls => JSON.parse(calls.find(call => call.url.includes('/rest/v1/enquiries') && call.method === 'POST').body)[0];
const metadata = calls => JSON.parse(calls.find(call => call.method === 'PATCH').body).file_paths;
const email = calls => JSON.parse(calls.find(call => call.url === 'https://api.resend.com/emails').body);

test('raw parsing enabled and JSON-only Phase 8 flow still works', async t => {
  assert.equal(config.api.bodyParser, false);
  const { calls } = mockBackend(t);
  const result = await invoke();
  assert.equal(result.status, 200);
  assert.equal(insert(calls).file_paths, null);
  assert.equal(uploads(calls).length, 0);
  assert.equal(email(calls).reply_to, valid.email);
  assert.deepEqual(email(calls).to, 'jessenyarko192@gmail.com');
});

test('already-parsed JSON stays compatible', async t => {
  mockBackend(t);
  assert.equal((await invoke({ body: valid })).status, 200);
});

test('multipart files uploaded privately, metadata saved, links signed for 7 days', async t => {
  const { calls, logs } = mockBackend(t);
  const result = await invoke(await multipart([{ name: 'brief.pdf' }, { name: 'image.png', type: 'image/png' }]));
  assert.equal(result.status, 200);
  assert.equal(uploads(calls).length, 2);
  assert.ok(calls.indexOf(calls.find(call => call.method === 'POST' && call.url.includes('/rest/v1/enquiries'))) < calls.indexOf(uploads(calls)[0]));
  const files = metadata(calls);
  assert.equal(files.length, 2);
  for (const file of files) {
    assert.match(file.path, /^enquiries\/[0-9a-f-]{36}\/[0-9a-f-]{36}-/);
    assert.equal(file.path.split('/')[1], result.body.id);
    assert.equal(file.size, 10);
    assert.ok(file.type);
    assert.ok(!JSON.stringify(file).includes('token='));
  }
  const signed = calls.filter(call => call.url.includes('/object/sign/'));
  assert.equal(signed.length, 2);
  signed.forEach(call => assert.equal(JSON.parse(call.body).expiresIn, 604800));
  assert.match(email(calls).html, /<a href="https:\/\/project.example.invalid\/storage\/v1\/object\/sign\//);
  assert.match(email(calls).html, /&amp;test=1/);
  assert.match(email(calls).html, /expire in 7 days/);
  assert.ok(!logs.join('').includes('token='));
  assert.ok(!calls.some(call => call.url.includes('/object/public/') || call.url.includes('/bucket')));
});

for (const [extension, mime] of Object.entries({
  pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', zip: 'application/zip'
})) {
  test(`accepts matching ${extension.toUpperCase()} extension/MIME`, async t => {
    mockBackend(t);
    assert.equal((await invoke(await multipart([{ name: `file.${extension.toUpperCase()}`, type: mime }]))).status, 200);
  });
}

for (const [label, files, pattern] of [
  ['four files', Array.from({ length: 4 }, () => ({})), /3 files/],
  ['wrong extension', [{ name: 'bad.exe' }], /extension and MIME/],
  ['wrong MIME', [{ name: 'brief.pdf', type: 'image/png' }], /extension and MIME/],
  ['generic MIME', [{ type: 'application/octet-stream' }], /extension and MIME/],
  ['empty file', [{ size: 0 }], /Empty files/],
  ['combined over 4MB', [{ size: 2_000_001 }, { size: 2_000_000 }], /Combined file size/],
  ['one file over 5MB', [{ size: 5_000_001 }], /Request too large/],
  ['unexpected file field', [{ field: 'avatar' }], /files field/]
]) {
  test(`rejects ${label} before any backend call`, async t => {
    const { calls } = mockBackend(t);
    const result = await invoke(await multipart(files));
    assert.equal(result.status, 400);
    assert.match(result.body.error, pattern);
    assert.equal(calls.length, 0);
  });
}

test('exact 4,000,000-byte total is accepted', async t => {
  mockBackend(t);
  assert.equal((await invoke(await multipart([{ size: 4_000_000 }]))).status, 200);
});

test('sanitizes and limits filenames before storage/metadata/email use', async t => {
  const { calls } = mockBackend(t);
  const file = { name: '../folder\\' + 'a'.repeat(180) + '"\'\u0001<script>.pdf' };
  assert.equal((await invoke(await multipart([file]))).status, 200);
  const saved = metadata(calls)[0];
  assert.ok(saved.name.length <= 144);
  assert.ok(!/[\\/"'\x00-\x1F\x7F<>]/.test(saved.name));
  assert.ok(saved.name.endsWith('.pdf'));
  assert.ok(!email(calls).html.includes('<script>'));
});

for (const failure of ['upload', 'oneUpload', 'metadata', 'sign', 'email']) {
  test(`${failure} failure does not lose enquiry`, async t => {
    const { calls, logs } = mockBackend(t, { [failure]: true });
    const result = await invoke(await multipart([{ name: 'a.pdf' }, { name: 'b.png', type: 'image/png' }]));
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(insert(calls).id, result.body.id);
    if (['upload', 'oneUpload', 'metadata'].includes(failure)) assert.ok(result.body.warnings.length);
    if (failure === 'metadata') assert.ok(calls.some(call => call.method === 'DELETE'));
    if (failure === 'oneUpload') assert.equal(metadata(calls).length, 1);
    if (failure === 'sign') assert.match(email(calls).html, /download link unavailable/);
    assert.ok(!logs.join('').includes('token='));
  });
}

test('honeypot and field validation still reject before backend writes', async t => {
  const { calls } = mockBackend(t);
  assert.equal((await invoke(await multipart([{}], { ...valid, website: 'spam' }))).status, 400);
  assert.equal((await invoke({ body: { ...valid, description: 'short' } })).status, 400);
  assert.equal(calls.length, 0);
});

test('rate limiting still prevents uploads', async t => {
  const { calls } = mockBackend(t, { rateLimit: true });
  const result = await invoke(await multipart([{}]));
  assert.equal(result.status, 429);
  assert.equal(result.headers['Retry-After'], '60');
  assert.equal(uploads(calls).length, 0);
});

test('failed enquiry insert prevents uploads', async t => {
  const { calls } = mockBackend(t, { insert: true });
  assert.equal((await invoke(await multipart([{}]))).status, 500);
  assert.equal(uploads(calls).length, 0);
});

test('service-role alternative works, missing configuration rejects', async t => {
  mockBackend(t);
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-alternative-placeholder';
  assert.equal((await invoke()).status, 200);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert.equal((await invoke()).status, 500);
});

test('malformed bodies, unsupported types and methods have proper errors', async t => {
  const { calls } = mockBackend(t);
  assert.equal((await invoke({ bytes: Buffer.from('{bad') })).status, 400);
  assert.equal((await invoke({ contentType: 'multipart/form-data; boundary=bad', bytes: Buffer.from('bad') })).status, 400);
  assert.equal((await invoke({ contentType: 'text/plain' })).status, 400);
  const result = await invoke({ method: 'GET' });
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'POST');
  assert.equal(calls.length, 0);
});
