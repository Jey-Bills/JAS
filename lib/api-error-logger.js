import { randomUUID } from 'node:crypto';

/**
 * Write one small, structured log entry for a serverless endpoint failure.
 * Error details are truncated and credential-like values, URLs and bearer tokens
 * are redacted so logs never contain request payloads or temporary download links.
 */
export function logApiError(endpoint, error) {
  let message = typeof error === 'string'
    ? error
    : typeof error?.message === 'string'
      ? error.message
      : 'unknown_error';

  message = message
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[redacted-url]')
    .replace(/\btoken[=:][^\s&"'<>]+/gi, 'token=[redacted]')
    .replace(/\b[A-Za-z0-9-]{2}_[A-Za-z0-9_-]{16,}\b/g, '[redacted-key]')
    .replace(/\b[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-token]')
    .slice(0, 240);

  console.error(JSON.stringify({
    endpoint,
    error: message || 'unknown_error',
    timestamp: new Date().toISOString(),
    request_id: randomUUID()
  }));
}
