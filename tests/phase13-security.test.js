import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { logApiError } from '../lib/api-error-logger.js';

const read = file => fs.readFileSync(file, 'utf8');

function collectHtmlFiles(directory = '.') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectHtmlFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(fullPath);
  }
  return files;
}

test('Vercel sets the requested security headers and permits only required CSP sources', () => {
  const config = JSON.parse(read('vercel.json'));
  const routeHeaders = config.headers.find(entry => entry.source === '/(.*)').headers;
  const headers = Object.fromEntries(routeHeaders.map(header => [header.key.toLowerCase(), header.value]));
  const csp = headers['content-security-policy'];
  assert.ok(csp);
  assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /style-src 'self' https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src 'self' https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /https:\/\/\*\.supabase\.co/);
  assert.match(csp, /wss:\/\/\*\.supabase\.co/);
  assert.match(csp, /https:\/\/images\.unsplash\.com/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(headers['permissions-policy'], 'geolocation=(), microphone=(), camera=()');
  assert.equal(headers['strict-transport-security'], 'max-age=31536000');
});

test('structured error logs include a request id and redact credentials, tokens and signed URLs', () => {
  const originalConsoleError = console.error;
  const lines = [];
  console.error = line => lines.push(String(line));
  try {
    const keyA = `${['s', 'k'].join('')}_${'a'.repeat(32)}`;
    const keyB = `${['r', 'e'].join('')}_${'b'.repeat(32)}`;
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
    const jwt = `${header}.${payload}.${'c'.repeat(32)}`;
    const signedUrl = 'https://project.supabase.co/storage/v1/object/sign/private/file?token=secret-value';
    logApiError('test-endpoint', new Error(`failed ${keyA} ${keyB} ${jwt} ${signedUrl}`));
  } finally {
    console.error = originalConsoleError;
  }
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.endpoint, 'test-endpoint');
  assert.ok(entry.request_id);
  assert.ok(entry.timestamp);
  assert.doesNotMatch(entry.error, /project\.supabase\.co|secret-value|service_role|a{20}|b{20}|c{20}/);
});

test('HTML contains no inline scripts or styles that would be blocked by the strict CSP', () => {
  for (const file of collectHtmlFiles()) {
    const html = read(file);
    assert.doesNotMatch(html, /\sstyle\s*=/i, `${file} should use a CSS class instead of inline styles`);
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
      assert.equal(match[2].trim(), '', `${file} has inline script content`);
    }
  }
});

test('the old static admin path is removed and only the renamed page paths are rewritten', () => {
  assert.equal(fs.existsSync('admin'), false);
  assert.equal(fs.existsSync('jas-hub/login.html'), true);
  assert.equal(fs.existsSync('jas-hub/index.html'), true);
  const config = JSON.parse(read('vercel.json'));
  assert.ok(config.rewrites.some(rule => rule.source === '/jas-hub/login'));
  assert.ok(config.rewrites.some(rule => rule.source === '/jas-hub/'));
  assert.ok(!config.rewrites.some(rule => rule.source.startsWith('/admin')));
  assert.ok(fs.existsSync('api/admin/signed-url.js'), 'The server-side API path stays unchanged');
});

test('every admin API handler verifies its Supabase session token server-side', () => {
  const files = fs.readdirSync('api/admin').filter(file => file.endsWith('.js'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const source = read(path.join('api/admin', file));
    assert.match(source, /auth\.getUser\(token\)/, `${file} must verify the token with Supabase Auth`);
    assert.match(source, /readBearerToken/, `${file} must read a bearer session token`);
  }
});

test('RLS migrations list only authenticated enquiry policies and leave the login counter without policies', () => {
  const adminSql = read('supabase/phase10-admin-auth.sql');
  const phase13Sql = read('supabase/phase13-auth-rate-limits.sql');
  for (const table of ['enquiries', 'rate_limits']) {
    assert.match(adminSql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`, 'i'));
  }
  assert.match(adminSql, /CREATE POLICY "enquiries_select_authenticated"[\s\S]*?FOR SELECT\s+TO authenticated/i);
  assert.match(adminSql, /CREATE POLICY "enquiries_update_authenticated"[\s\S]*?FOR UPDATE\s+TO authenticated/i);
  assert.match(adminSql, /CREATE POLICY "rate_limits_select_authenticated"[\s\S]*?FOR SELECT\s+TO authenticated/i);
  assert.doesNotMatch(adminSql, /CREATE POLICY[\s\S]*?TO\s+(?:anon|public)\b/i);
  assert.match(phase13Sql, /ALTER TABLE public\.auth_rate_limits ENABLE ROW LEVEL SECURITY/i);
  assert.match(phase13Sql, /REVOKE ALL ON TABLE public\.auth_rate_limits FROM PUBLIC, anon, authenticated/i);
  assert.match(phase13Sql, /GRANT ALL ON TABLE public\.auth_rate_limits TO service_role/i);
  assert.match(phase13Sql, /DELETE FROM public\.auth_rate_limits/i);
  assert.match(phase13Sql, /DROP POLICY %I ON public\.auth_rate_limits/i);
  const createdPolicies = [...phase13Sql.matchAll(/CREATE POLICY\s+"([^"]+)"/gi)].map(match => match[1]);
  assert.deepEqual(createdPolicies, [
    'enquiries_select_authenticated',
    'enquiries_update_authenticated',
    'rate_limits_select_authenticated'
  ]);
});
