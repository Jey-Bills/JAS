import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import configHandler from '../api/config.js';
import {
  getSupabaseClient,
  resolvePublicConfig,
  isForbiddenSecretKey,
  resetSupabaseClientForTests
} from '../js/supabase-client.js';
import {
  getSession,
  requireAuth,
  requireGuest,
  signIn,
  signOut,
  checkServerRateLimit,
  SERVER_RATE_LIMIT_ENDPOINT,
  getRateLimitState,
  clearFailedAttempts,
  setRedirectHandlerForTests,
  LOGIN_URL,
  DASHBOARD_URL
} from '../js/admin-auth.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    }
  };
}

function invokeConfig({ method = 'GET' } = {}) {
  const req = { method, headers: {} };
  const result = { headers: {} };
  const res = {
    setHeader(k, v) {
      result.headers[k] = v;
    },
    status(code) {
      result.status = code;
      return this;
    },
    json(body) {
      result.body = body;
      return this;
    }
  };
  configHandler(req, res);
  return result;
}

test('api/config returns public SUPABASE_URL and SUPABASE_ANON_KEY only', t => {
  const origEnv = { ...process.env };
  t.after(() => {
    process.env = origEnv;
  });

  process.env.SUPABASE_URL = 'https://example-project.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'public-anon-key-placeholder';
  process.env.SUPABASE_SECRET_KEY = 'super-secret-service-role-key';

  const res = invokeConfig({ method: 'GET' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    supabaseUrl: 'https://example-project.supabase.co',
    supabaseAnonKey: 'public-anon-key-placeholder'
  });
  assert.ok(!JSON.stringify(res.body).includes('super-secret'));
});

test('api/config supports SUPABASE_PUBLISHABLE_KEY fallback and rejects non-GET or secret leakage', t => {
  const origEnv = { ...process.env };
  t.after(() => {
    process.env = origEnv;
  });

  delete process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example-project.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_key';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_real_secret';

  const okRes = invokeConfig({ method: 'GET' });
  assert.equal(okRes.status, 200);
  assert.equal(okRes.body.supabaseAnonKey, 'sb_publishable_test_key');

  const postRes = invokeConfig({ method: 'POST' });
  assert.equal(postRes.status, 405);
  assert.equal(postRes.headers.Allow, 'GET');

  // Misconfigured anon key matching secret key must be rejected with 500
  process.env.SUPABASE_ANON_KEY = 'sb_secret_real_secret';
  const badRes = invokeConfig({ method: 'GET' });
  assert.equal(badRes.status, 500);
});

test('isForbiddenSecretKey detects sb_secret_ and service_role JWTs', () => {
  assert.equal(isForbiddenSecretKey(''), true);
  assert.equal(isForbiddenSecretKey('sb_secret_12345'), true);

  const serviceRolePayload = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  const anonPayload = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  assert.equal(isForbiddenSecretKey(`${header}.${serviceRolePayload}.sig`), true);
  assert.equal(isForbiddenSecretKey(`${header}.${anonPayload}.sig`), false);
  assert.equal(isForbiddenSecretKey('sb_publishable_safe_key'), false);
});

test('resolvePublicConfig fetches /api/config when inline config is empty', async t => {
  const origFetch = globalThis.fetch;
  const origConfig = globalThis.JAS_CONFIG;
  t.after(() => {
    globalThis.fetch = origFetch;
    globalThis.JAS_CONFIG = origConfig;
    resetSupabaseClientForTests(null);
  });

  globalThis.JAS_CONFIG = { supabaseUrl: '', supabaseAnonKey: '', configEndpoint: '/api/config' };
  globalThis.fetch = async url => {
    assert.equal(url, '/api/config');
    return new Response(
      JSON.stringify({
        supabaseUrl: 'https://fetched.supabase.co',
        supabaseAnonKey: 'sb_publishable_fetched'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const resolved = await resolvePublicConfig();
  assert.equal(resolved.supabaseUrl, 'https://fetched.supabase.co');
  assert.equal(resolved.supabaseAnonKey, 'sb_publishable_fetched');
});

test('login calls the server rate-limit endpoint and fails closed when blocked or unavailable', async t => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new Response(JSON.stringify({ allowed: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
  assert.deepEqual(await checkServerRateLimit(' Owner@Example.com '), { allowed: true });
  assert.equal(requests[0].url, SERVER_RATE_LIMIT_ENDPOINT);
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), { email: 'owner@example.com' });

  globalThis.fetch = async () => new Response(JSON.stringify({ allowed: false, retryAfter: 240 }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '240' }
  });
  await assert.rejects(
    () => checkServerRateLimit('owner@example.com'),
    error => error.code === 'RATE_LIMITED' && error.retryAfter === 240
  );

  globalThis.fetch = async () => { throw new Error('network unavailable'); };
  await assert.rejects(
    () => checkServerRateLimit('owner@example.com'),
    error => error.code === 'RATE_LIMIT_CHECK_FAILED'
  );
});

test('signIn, requireAuth, requireGuest, signOut, and generic error handling', async t => {
  const storage = createMemoryStorage();
  globalThis.localStorage = storage;

  let activeSession = null;
  let redirectedTo = null;
  setRedirectHandlerForTests(url => {
    redirectedTo = url;
  });

  const mockClient = {
    auth: {
      async getSession() {
        return { data: { session: activeSession }, error: null };
      },
      async signInWithPassword({ email, password }) {
        if (email === 'jessenyarko192@gmail.com' && password === 'correct-owner-pass') {
          activeSession = {
            access_token: 'mock-jwt-token',
            user: { id: 'owner-uuid', email: 'jessenyarko192@gmail.com' }
          };
          return { data: { session: activeSession, user: activeSession.user }, error: null };
        }
        return { data: { session: null, user: null }, error: new Error('Invalid login credentials') };
      },
      async signOut() {
        activeSession = null;
        return { error: null };
      },
      onAuthStateChange() {
        return { data: { subscription: { unsubscribe() {} } } };
      }
    }
  };

  resetSupabaseClientForTests(mockClient);
  t.after(() => {
    resetSupabaseClientForTests(null);
    setRedirectHandlerForTests(null);
  });

  // 1. Unauthenticated requireAuth redirects to /jas-hub/login.html
  redirectedTo = null;
  const authCheck1 = await requireAuth();
  assert.equal(authCheck1, null);
  assert.equal(redirectedTo, LOGIN_URL);

  // 2. Unauthenticated requireGuest does not redirect
  redirectedTo = null;
  const guestCheck1 = await requireGuest();
  assert.equal(guestCheck1, null);
  assert.equal(redirectedTo, null);

  // 3. Wrong email returns generic "Invalid email or password"
  await assert.rejects(
    () => signIn('someoneelse@example.com', 'any-password'),
    err => {
      assert.equal(err.message, 'Invalid email or password');
      return true;
    }
  );

  // 4. Wrong password returns generic "Invalid email or password"
  await assert.rejects(
    () => signIn('jessenyarko192@gmail.com', 'wrong-password'),
    err => {
      assert.equal(err.message, 'Invalid email or password');
      return true;
    }
  );

  // 5. Correct owner login succeeds and clears failed attempts
  const loginRes = await signIn('jessenyarko192@gmail.com', 'correct-owner-pass');
  assert.equal(loginRes.user.email, 'jessenyarko192@gmail.com');
  assert.equal(getRateLimitState().attempts, 0);

  // 6. Authenticated requireGuest redirects to /jas-hub/
  redirectedTo = null;
  const guestCheck2 = await requireGuest();
  assert.ok(guestCheck2);
  assert.equal(redirectedTo, DASHBOARD_URL);

  // 7. Authenticated requireAuth returns session without redirecting
  redirectedTo = null;
  const authCheck2 = await requireAuth();
  assert.equal(authCheck2.user.email, 'jessenyarko192@gmail.com');
  assert.equal(redirectedTo, null);

  // 8. signOut clears session and redirects to /jas-hub/login.html
  redirectedTo = null;
  await signOut();
  assert.equal(await getSession(), null);
  assert.equal(redirectedTo, LOGIN_URL);
});

test('5 failed attempts within 15 minutes locks login for 15 minutes', async t => {
  const storage = createMemoryStorage();
  globalThis.localStorage = storage;
  clearFailedAttempts();

  let supabaseCalls = 0;
  const mockClient = {
    auth: {
      async getSession() {
        return { data: { session: null }, error: null };
      },
      async signInWithPassword() {
        supabaseCalls += 1;
        return { data: { session: null, user: null }, error: new Error('Invalid login credentials') };
      },
      async signOut() {
        return { error: null };
      }
    }
  };

  resetSupabaseClientForTests(mockClient);
  t.after(() => {
    resetSupabaseClientForTests(null);
  });

  const baseTime = 1_700_000_000_000;

  // Attempts 1 to 4 fail with generic message and are not yet locked
  for (let i = 1; i <= 4; i++) {
    await assert.rejects(
      () => signIn('jessenyarko192@gmail.com', 'wrong-pass', baseTime + i * 1000),
      err => {
        assert.equal(err.message, 'Invalid email or password');
        assert.equal(err.code, 'INVALID_CREDENTIALS');
        return true;
      }
    );
    assert.equal(getRateLimitState(baseTime + i * 1000).locked, false);
    assert.equal(getRateLimitState(baseTime + i * 1000).attempts, i);
  }

  // 5th failed attempt triggers the 15-minute lockout
  const fifthTime = baseTime + 5000;
  await assert.rejects(
    () => signIn('jessenyarko192@gmail.com', 'wrong-pass', fifthTime),
    err => {
      assert.equal(err.code, 'RATE_LIMITED');
      assert.match(err.message, /15 minutes/);
      return true;
    }
  );

  const lockedState = getRateLimitState(fifthTime + 1000);
  assert.equal(lockedState.locked, true);
  assert.equal(lockedState.remainingMinutes, 15);
  assert.equal(supabaseCalls, 5);

  // 6th attempt while locked is blocked before calling Supabase
  await assert.rejects(
    () => signIn('jessenyarko192@gmail.com', 'correct-owner-pass', fifthTime + 60_000),
    err => {
      assert.equal(err.code, 'RATE_LIMITED');
      return true;
    }
  );
  assert.equal(supabaseCalls, 5);

  // After 15 minutes have elapsed, lockout expires
  const afterLockout = fifthTime + 15 * 60 * 1000 + 1;
  const unlockedState = getRateLimitState(afterLockout);
  assert.equal(unlockedState.locked, false);
  assert.equal(unlockedState.attempts, 0);
});

test('admin HTML, SQL, and browser files meet Phase 13 acceptance and security constraints', () => {
  const loginHtml = fs.readFileSync('jas-hub/login.html', 'utf8');
  const dashboardHtml = fs.readFileSync('jas-hub/index.html', 'utf8');
  const sql = fs.readFileSync('supabase/phase10-admin-auth.sql', 'utf8');

  // Login page checks
  assert.match(loginHtml, /id="admin-login-form"/);
  assert.match(loginHtml, /id="login-email"/);
  assert.match(loginHtml, /id="login-password"/);
  assert.match(loginHtml, /Authorised access only\. Failed attempts are logged\./);
  assert.match(loginHtml, /href="\.\.\/index\.html"/);
  assert.doesNotMatch(loginHtml, /jessenyarko192@gmail\.com/i, 'Login page must not display the owner email');
  assert.doesNotMatch(dashboardHtml, /jessenyarko192@gmail\.com/i, 'Unauthenticated dashboard shell must not display the owner email');
  assert.doesNotMatch(loginHtml, /id="login-email"[^>]*(?:placeholder|value)=/i, 'Email field must start blank');
  assert.doesNotMatch(loginHtml, /login-email-hint/i, 'Login page must not show an email hint');
  const authSource = fs.readFileSync('js/admin-auth.js', 'utf8');
  assert.ok(
    authSource.indexOf('await checkServerRateLimit(emailVal)') < authSource.indexOf('await signIn(emailVal, passwordVal)'),
    'Server limit must be checked before Supabase password sign-in'
  );

  // Dashboard page checks
  assert.match(dashboardHtml, /Signed in as/);
  assert.match(dashboardHtml, /id="stat-total"/);
  assert.match(dashboardHtml, /id="filter-status"/);
  assert.match(dashboardHtml, /id="enquiry-table-body"/);
  assert.doesNotMatch(dashboardHtml, /Dashboard coming in Phase 11\./);
  assert.match(dashboardHtml, /id="admin-logout-btn"/);

  // SQL checks
  assert.match(sql, /ALTER TABLE public\.enquiries ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /ALTER TABLE public\.rate_limits ENABLE ROW LEVEL SECURITY/i);
  assert.match(sql, /FOR SELECT\s+TO authenticated/i);
  assert.match(sql, /FOR UPDATE\s+TO authenticated/i);

  // Ensure no browser-facing file references or exposes service role / secret env vars
  for (const file of ['jas-hub/login.html', 'jas-hub/index.html', 'js/config.js', 'js/admin-auth.js', 'js/supabase-client.js', 'js/admin-dashboard.js']) {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(!content.includes('process.env.SUPABASE_SECRET_KEY'));
    assert.ok(!content.includes('process.env.SUPABASE_SERVICE_ROLE_KEY'));
  }

  assert.equal(fs.existsSync('admin'), false, 'Old static admin folder must be removed');
  assert.equal(LOGIN_URL, '/jas-hub/login.html');
  assert.equal(DASHBOARD_URL, '/jas-hub/');
  const routes = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  assert.ok(routes.rewrites.some(rule => rule.source === '/jas-hub/' && rule.destination === '/jas-hub/index.html'));
  assert.ok(!routes.rewrites.some(rule => rule.source.startsWith('/admin')));
});
