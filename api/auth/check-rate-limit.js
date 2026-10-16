import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { logApiError } from '../../lib/api-error-logger.js';

const MAX_BODY_BYTES = 2048;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 200;
const WINDOW_SECONDS = 15 * 60;

function respond(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function fail(res, status, body, errorCode) {
  logApiError('auth/check-rate-limit', errorCode);
  return respond(res, status, body);
}

function readJsonBody(req) {
  const contentType = req.headers?.['content-type'];
  if (contentType && !/^application\/json(?:;|$)/i.test(contentType)) return null;
  const contentLength = Number(req.headers?.['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return null;

  let body = req.body;
  if (Buffer.isBuffer(body) || typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) return null;
    try {
      body = JSON.parse(body.toString());
    } catch {
      return null;
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  try {
    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) return null;
  } catch {
    return null;
  }
  if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'email')) return null;
  return body;
}

function getClientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().slice(0, 128) || 'unknown';
  }
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim().slice(0, 128);
  const remoteAddress = req.socket?.remoteAddress;
  return typeof remoteAddress === 'string' && remoteAddress.trim()
    ? remoteAddress.trim().slice(0, 128)
    : 'unknown';
}

function createServerClient(url, secretKey) {
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

/**
 * Consume one login attempt for the normalized email + client IP pair.
 * The database function performs the count/window update atomically.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logApiError('auth/check-rate-limit', 'method_not_allowed');
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  const body = readJsonBody(req);
  if (!body) {
    return fail(res, 400, { error: 'Provide a valid JSON body with an email address.' }, 'invalid_request_body');
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
    return fail(res, 400, { error: 'Provide a valid email address.' }, 'invalid_email');
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return fail(res, 503, { error: 'Sign-in protection is temporarily unavailable. Please try again shortly.' }, 'rate_limit_service_not_configured');
  }

  try {
    const identifierHash = crypto.createHash('sha256')
      .update(`${email}\n${getClientIp(req)}`)
      .digest('hex');
    const supabase = createServerClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase.rpc('consume_auth_login_rate_limit', {
      p_identifier_hash: identifierHash
    });

    if (error) {
      logApiError('auth/check-rate-limit', 'rate_limit_database_check_failed');
      return respond(res, 503, { error: 'Sign-in protection is temporarily unavailable. Please try again shortly.' });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.allowed !== 'boolean') {
      logApiError('auth/check-rate-limit', 'rate_limit_database_returned_invalid_result');
      return respond(res, 503, { error: 'Sign-in protection is temporarily unavailable. Please try again shortly.' });
    }

    if (!result.allowed) {
      const retryAfter = Math.min(
        WINDOW_SECONDS,
        Math.max(1, Math.ceil(Number(result.retry_after) || WINDOW_SECONDS))
      );
      logApiError('auth/check-rate-limit', 'login_rate_limit_exceeded');
      res.setHeader('Retry-After', String(retryAfter));
      return respond(res, 429, {
        allowed: false,
        error: 'Too many sign-in attempts. Please wait before trying again.',
        retryAfter
      });
    }

    return respond(res, 200, { allowed: true });
  } catch (error) {
    logApiError('auth/check-rate-limit', error);
    return respond(res, 503, { error: 'Sign-in protection is temporarily unavailable. Please try again shortly.' });
  }
}
