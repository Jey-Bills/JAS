import { createClient } from '@supabase/supabase-js';
import { logApiError } from '../../lib/api-error-logger.js';

const OWNER_EMAIL = 'jessenyarko192@gmail.com';
const BUCKET_NAME = 'enquiry-files';
const SIGNED_URL_SECONDS = 60;
const MAX_BODY_BYTES = 4096;
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ATTACHMENT_PATH_PATTERN = new RegExp(
  `^enquiries/(${UUID_PATTERN})/(${UUID_PATTERN})-([A-Za-z0-9._ -]{1,180})$`,
  'i'
);

function respond(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function fail(res, status, body, errorCode) {
  logApiError('admin/signed-url', errorCode);
  return respond(res, status, body);
}

function readBearerToken(req) {
  const authorization = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authorization !== 'string' || authorization.length > 9000) return null;
  const match = authorization.trim().match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > 8192) return null;
  return match[1];
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
  if (Object.keys(body).length !== 1 || !Object.hasOwn(body, 'path')) return null;
  if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) return null;
  return body;
}

function validateAttachmentPath(path) {
  if (typeof path !== 'string' || path.length > 512 || path !== path.trim()) return null;
  const match = path.match(ATTACHMENT_PATH_PATTERN);
  if (!match) return null;
  return { enquiryId: match[1], path };
}

function safeDownloadName(value) {
  if (typeof value !== 'string') return 'attachment';
  const name = value
    .replace(/[\\/\x00-\x1F\x7F]/g, '_')
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180);
  return name || 'attachment';
}

function createAdminClient(url, secretKey) {
  return createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

/**
 * Create a short-lived private Storage URL only for the authenticated studio owner
 * and only for attachment paths still referenced by an enquiry row.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    logApiError('admin/signed-url', 'method_not_allowed');
    res.setHeader('Allow', 'POST');
    return respond(res, 405, { error: 'Method not allowed. Use POST.' });
  }

  const token = readBearerToken(req);
  if (!token) {
    return fail(res, 401, { error: 'Sign in to download this attachment.' }, 'missing_or_malformed_bearer_token');
  }

  const body = readJsonBody(req);
  if (!body) {
    return fail(res, 400, { error: 'Provide a valid JSON request body.' }, 'invalid_request_body');
  }

  const requested = validateAttachmentPath(body.path);
  if (!requested) {
    return fail(res, 400, { error: 'The attachment path is invalid.' }, 'invalid_attachment_path');
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
  const serviceRoleKey = (
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ''
  ).trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return fail(res, 500, { error: 'Private downloads are not configured.' }, 'private_downloads_not_configured');
  }

  try {
    const supabase = createAdminClient(supabaseUrl, serviceRoleKey);

    // Do not trust the browser session or email claim: ask Supabase Auth to verify the token.
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError) {
      const authStatus = Number(authError.status);
      const status = authStatus >= 500 ? 500 : 401;
      return fail(res, status, {
        error: status === 401 ? 'Your sign-in session is invalid or has expired.' : 'Could not verify your sign-in session.'
      }, status === 401 ? 'invalid_or_expired_session' : 'session_verification_unavailable');
    }
    const user = authData?.user;
    if (!user) {
      return fail(res, 401, { error: 'Your sign-in session is invalid or has expired.' }, 'missing_verified_user');
    }
    if (String(user.email || '').trim().toLowerCase() !== OWNER_EMAIL) {
      return fail(res, 403, { error: 'Only the studio owner can download enquiry attachments.' }, 'non_owner_access_denied');
    }

    // Verify this exact object path is still attached to the referenced enquiry.
    const { data: enquiry, error: enquiryError } = await supabase
      .from('enquiries')
      .select('id,file_paths')
      .eq('id', requested.enquiryId)
      .maybeSingle();
    if (enquiryError) {
      return fail(res, 500, { error: 'Could not verify the attachment.' }, 'attachment_lookup_failed');
    }
    const attachments = Array.isArray(enquiry?.file_paths) ? enquiry.file_paths : [];
    const attachment = attachments.find(file => file && file.path === requested.path);
    if (!attachment) {
      return fail(res, 404, { error: 'This attachment was not found.' }, 'attachment_not_found');
    }

    const downloadName = safeDownloadName(attachment.name);
    const { data: signedData, error: signingError } = await supabase
      .storage
      .from(BUCKET_NAME)
      .createSignedUrl(requested.path, SIGNED_URL_SECONDS, { download: downloadName });

    if (signingError || typeof signedData?.signedUrl !== 'string' || !signedData.signedUrl) {
      const storageStatus = Number(signingError?.statusCode || signingError?.status);
      if (storageStatus === 404) {
        return fail(res, 404, { error: 'This attachment was not found.' }, 'attachment_not_found_in_storage');
      }
      return fail(res, 500, { error: 'Could not prepare the attachment download.' }, 'signed_url_creation_failed');
    }

    // Never log or cache the signed URL; possession of it grants temporary file access.
    return respond(res, 200, { url: signedData.signedUrl });
  } catch (error) {
    logApiError('admin/signed-url', error);
    return respond(res, 500, { error: 'Could not prepare the attachment download.' });
  }
}
