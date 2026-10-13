/**
 * Admin authentication & client-side rate limiting for Jey's Academic Studio (Phase 10).
 *
 * Exports:
 * - getSession()
 * - requireAuth()
 * - requireGuest()
 * - signIn(email, password)
 * - signOut()
 * - Rate limit helpers (5 failed attempts within 15 minutes -> 15-minute lockout)
 */

import { getSupabaseClient } from './supabase-client.js';

export const OWNER_EMAIL = 'jessenyarko192@gmail.com';
export const LOGIN_URL = '/admin/login.html';
export const DASHBOARD_URL = '/admin/';
export const RATE_LIMIT_STORAGE_KEY = 'jas_admin_login_attempts';
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let redirectHandler = url => {
  if (typeof globalThis.location !== 'undefined') {
    if (typeof globalThis.location.replace === 'function') {
      globalThis.location.replace(url);
    } else {
      globalThis.location.href = url;
    }
  }
};

/**
 * Override redirect handler in unit tests.
 */
export function setRedirectHandlerForTests(fn) {
  redirectHandler =
    typeof fn === 'function'
      ? fn
      : url => {
          if (typeof globalThis.location !== 'undefined') {
            globalThis.location.replace(url);
          }
        };
}

/**
 * Check whether an email matches the authorised studio owner account.
 */
export function isOwnerEmail(email) {
  return String(email || '').trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

/**
 * Format a human-readable lockout message showing remaining wait time.
 */
export function formatLockoutMessage(remainingMs) {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Too many failed sign-in attempts. Please wait ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} before trying again.`;
}

/**
 * Read and normalise the current login rate-limit state from localStorage.
 * Locks out for 15 minutes after 5 failed attempts within a 15-minute rolling window.
 */
export function getRateLimitState(now = Date.now()) {
  const storage = globalThis.localStorage;
  if (!storage) {
    return {
      locked: false,
      attempts: 0,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      remainingMs: 0,
      remainingMinutes: 0,
      lockedUntil: null,
      message: ''
    };
  }

  let parsed = { attempts: [], lockedUntil: null };
  try {
    const raw = storage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        parsed = {
          attempts: Array.isArray(data.attempts) ? data.attempts : [],
          lockedUntil: typeof data.lockedUntil === 'number' ? data.lockedUntil : null
        };
      }
    }
  } catch {
    parsed = { attempts: [], lockedUntil: null };
  }

  // If a previous lockout has expired, clear the stored record.
  if (parsed.lockedUntil && now >= parsed.lockedUntil) {
    try {
      storage.removeItem(RATE_LIMIT_STORAGE_KEY);
    } catch {
      // Ignore storage write errors.
    }
    return {
      locked: false,
      attempts: 0,
      remainingAttempts: MAX_FAILED_ATTEMPTS,
      remainingMs: 0,
      remainingMinutes: 0,
      lockedUntil: null,
      message: ''
    };
  }

  // Keep only failed attempts within the last 15 minutes.
  const recentAttempts = parsed.attempts.filter(
    ts => typeof ts === 'number' && Number.isFinite(ts) && now - ts < LOCKOUT_WINDOW_MS && ts <= now
  );

  let lockedUntil = parsed.lockedUntil;
  if (!lockedUntil && recentAttempts.length >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = recentAttempts[recentAttempts.length - 1] + LOCKOUT_WINDOW_MS;
  }

  if (lockedUntil && now < lockedUntil) {
    const remainingMs = lockedUntil - now;
    const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
    try {
      storage.setItem(
        RATE_LIMIT_STORAGE_KEY,
        JSON.stringify({ attempts: recentAttempts, lockedUntil })
      );
    } catch {
      // Ignore storage write errors.
    }
    return {
      locked: true,
      attempts: recentAttempts.length,
      remainingAttempts: 0,
      remainingMs,
      remainingMinutes,
      lockedUntil,
      message: formatLockoutMessage(remainingMs)
    };
  }

  return {
    locked: false,
    attempts: recentAttempts.length,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - recentAttempts.length),
    remainingMs: 0,
    remainingMinutes: 0,
    lockedUntil: null,
    message: ''
  };
}

/**
 * Record a failed login attempt in localStorage and return the updated rate-limit state.
 */
export function recordFailedAttempt(now = Date.now()) {
  const storage = globalThis.localStorage;
  const current = getRateLimitState(now);
  if (current.locked) return current;

  let recentAttempts = [];
  if (storage) {
    try {
      const raw = storage.getItem(RATE_LIMIT_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data?.attempts)) {
          recentAttempts = data.attempts.filter(
            ts => typeof ts === 'number' && Number.isFinite(ts) && now - ts < LOCKOUT_WINDOW_MS && ts <= now
          );
        }
      }
    } catch {
      recentAttempts = [];
    }
  }

  recentAttempts.push(now);
  const lockedUntil =
    recentAttempts.length >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : null;

  if (storage) {
    try {
      storage.setItem(
        RATE_LIMIT_STORAGE_KEY,
        JSON.stringify({ attempts: recentAttempts, lockedUntil })
      );
    } catch {
      // Ignore storage write errors.
    }
  }

  return getRateLimitState(now);
}

/**
 * Clear recorded failed login attempts upon successful login.
 */
export function clearFailedAttempts() {
  const storage = globalThis.localStorage;
  if (!storage) return;
  try {
    storage.removeItem(RATE_LIMIT_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/**
 * Return the active Supabase session if authenticated as the studio owner, or null.
 */
export async function getSession() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session || !data.session.user) {
      return null;
    }
    if (!isOwnerEmail(data.session.user.email)) {
      await supabase.auth.signOut().catch(() => {});
      return null;
    }
    return data.session;
  } catch {
    return null;
  }
}

/**
 * Ensure the visitor has an active owner session; otherwise redirect to /admin/login.html.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirectHandler(LOGIN_URL);
    return null;
  }
  return session;
}

/**
 * Ensure the visitor is not already logged in; if logged in, redirect to /admin/.
 */
export async function requireGuest() {
  const session = await getSession();
  if (session) {
    redirectHandler(DASHBOARD_URL);
    return session;
  }
  return null;
}

/**
 * Sign in with email and password via Supabase Auth.
 * Enforces the 5-attempt / 15-minute lockout and always returns a generic error
 * ("Invalid email or password") when credentials do not match.
 */
export async function signIn(email, password, now = Date.now()) {
  const rateState = getRateLimitState(now);
  if (rateState.locked) {
    const lockoutError = new Error(rateState.message);
    lockoutError.code = 'RATE_LIMITED';
    lockoutError.rateLimit = rateState;
    throw lockoutError;
  }

  const cleanEmail = String(email ?? '').trim().toLowerCase();
  const rawPassword = String(password ?? '');

  if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail) || !rawPassword) {
    const validationError = new Error('Please enter both your email address and password.');
    validationError.code = 'VALIDATION_ERROR';
    throw validationError;
  }

  const supabase = await getSupabaseClient();

  let authData = null;
  let authError = null;

  // Only the studio owner account is permitted to sign in.
  // For any non-owner email or wrong password, record a failed attempt and return the same generic error.
  if (isOwnerEmail(cleanEmail)) {
    const result = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: rawPassword
    });
    authData = result.data;
    authError = result.error;
  } else {
    authError = new Error('Invalid login credentials');
  }

  if (
    authError ||
    !authData?.session ||
    !authData?.user ||
    !isOwnerEmail(authData.user.email)
  ) {
    if (authData?.session && !isOwnerEmail(authData?.user?.email)) {
      await supabase.auth.signOut().catch(() => {});
    }
    const updatedRate = recordFailedAttempt(now);
    const message = updatedRate.locked
      ? `Invalid email or password. ${updatedRate.message}`
      : 'Invalid email or password';
    const invalidError = new Error(message);
    invalidError.code = updatedRate.locked ? 'RATE_LIMITED' : 'INVALID_CREDENTIALS';
    invalidError.rateLimit = updatedRate;
    throw invalidError;
  }

  clearFailedAttempts();
  return {
    session: authData.session,
    user: authData.user
  };
}

/**
 * Clear the active Supabase session and redirect to /admin/login.html.
 */
export async function signOut() {
  try {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Always redirect to login even if the network call fails.
  }
  redirectHandler(LOGIN_URL);
}

/**
 * Wire up the /admin/login.html form and states when present in the DOM.
 */
export async function initLoginPage() {
  if (typeof document === 'undefined') return;
  const form = document.getElementById('admin-login-form');
  if (!form) return;

  // Redirect immediately if already authenticated.
  const existingSession = await requireGuest();
  if (existingSession) return;

  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  const emailError = document.getElementById('login-email-error');
  const passwordError = document.getElementById('login-password-error');
  const errorPanel = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');
  const successPanel = document.getElementById('login-success');
  const successText = document.getElementById('login-success-text');
  const submitBtn = document.getElementById('login-submit-btn');
  const submitText = document.getElementById('login-submit-text');

  let lockoutTimer = null;

  const showBannerError = message => {
    if (!errorPanel || !errorText) return;
    errorText.textContent = message;
    errorPanel.hidden = false;
  };

  const hideBannerError = () => {
    if (errorPanel) errorPanel.hidden = true;
  };

  const setFieldError = (input, errorEl, message) => {
    if (!input || !errorEl) return;
    const fieldWrap = input.closest('.field');
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
    if (fieldWrap) fieldWrap.classList.toggle('has-error', Boolean(message));
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };

  const syncLockoutUi = () => {
    const state = getRateLimitState();
    if (state.locked) {
      showBannerError(state.message);
      if (submitBtn) submitBtn.disabled = true;
      if (emailInput) emailInput.disabled = true;
      if (passwordInput) passwordInput.disabled = true;
      if (submitText) submitText.textContent = 'Locked';
      if (!lockoutTimer) {
        lockoutTimer = setInterval(() => {
          const nextState = getRateLimitState();
          if (!nextState.locked) {
            clearInterval(lockoutTimer);
            lockoutTimer = null;
            hideBannerError();
            if (submitBtn) submitBtn.disabled = false;
            if (emailInput) emailInput.disabled = false;
            if (passwordInput) passwordInput.disabled = false;
            if (submitText) submitText.textContent = 'Sign in';
          } else {
            showBannerError(nextState.message);
          }
        }, 1000);
      }
      return true;
    }
    return false;
  };

  syncLockoutUi();

  form.addEventListener('input', () => {
    if (!getRateLimitState().locked) {
      hideBannerError();
    }
    if (emailInput && emailError && !emailError.hidden) {
      setFieldError(emailInput, emailError, '');
    }
    if (passwordInput && passwordError && !passwordError.hidden) {
      setFieldError(passwordInput, passwordError, '');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (syncLockoutUi()) return;
    if (submitBtn?.disabled) return;

    hideBannerError();
    setFieldError(emailInput, emailError, '');
    setFieldError(passwordInput, passwordError, '');

    const emailVal = (emailInput?.value || '').trim();
    const passwordVal = passwordInput?.value || '';

    let hasValidationError = false;
    if (!emailVal || !EMAIL_REGEX.test(emailVal)) {
      setFieldError(emailInput, emailError, 'Please enter a valid email address.');
      hasValidationError = true;
    }
    if (!passwordVal) {
      setFieldError(passwordInput, passwordError, 'Please enter your password.');
      hasValidationError = true;
    }
    if (hasValidationError) {
      if (!emailVal || !EMAIL_REGEX.test(emailVal)) emailInput?.focus();
      else passwordInput?.focus();
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Signing in…';

    try {
      await signIn(emailVal, passwordVal);
      if (passwordInput) passwordInput.value = '';
      if (successText) {
        successText.textContent = 'Signed in. Redirecting to dashboard…';
      }
      if (successPanel) successPanel.hidden = false;
      redirectHandler(DASHBOARD_URL);
    } catch (error) {
      if (passwordInput) passwordInput.value = '';
      if (!syncLockoutUi()) {
        showBannerError(error?.message || 'Invalid email or password');
        if (submitBtn) submitBtn.disabled = false;
        if (submitText) submitText.textContent = 'Sign in';
        passwordInput?.focus();
      }
    }
  });
}

/**
 * Wire up the protected /admin/index.html page when present in the DOM.
 */
export async function initDashboardPage() {
  if (typeof document === 'undefined') return;
  const dashboardRoot = document.getElementById('admin-dashboard-page');
  if (!dashboardRoot) return;

  const checkingEl = document.getElementById('admin-auth-checking');
  const contentEl = document.getElementById('admin-dashboard-content');
  const emailEl = document.getElementById('admin-user-email');
  const logoutButtons = document.querySelectorAll('[data-admin-logout], #admin-logout-btn');

  const session = await requireAuth();
  if (!session) {
    return;
  }

  if (emailEl) {
    emailEl.textContent = session.user.email;
  }
  if (checkingEl) {
    checkingEl.hidden = true;
  }
  if (contentEl) {
    contentEl.hidden = false;
  }

  logoutButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      logoutButtons.forEach(b => {
        b.disabled = true;
      });
      btn.textContent = 'Signing out…';
      await signOut();
    });
  });

  // Listen for sign-out or session expiry in another tab.
  try {
    const supabase = await getSupabaseClient();
    supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT' || !nextSession) {
        redirectHandler(LOGIN_URL);
      }
    });
  } catch {
    // Ignore listener setup error.
  }
}

if (typeof globalThis !== 'undefined') {
  globalThis.JAS_AUTH = {
    getSession,
    requireAuth,
    requireGuest,
    signIn,
    signOut,
    getRateLimitState,
    recordFailedAttempt,
    clearFailedAttempts,
    isOwnerEmail
  };
}

if (typeof document !== 'undefined') {
  const boot = () => {
    initLoginPage();
    initDashboardPage();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
