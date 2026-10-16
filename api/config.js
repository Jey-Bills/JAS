import { logApiError } from '../lib/api-error-logger.js';

/**
 * Public Supabase configuration endpoint for browser-side Auth (/jas-hub).
 * Returns ONLY the project URL and public anon/publishable key from environment variables.
 * Never exposes the server-side secret key or the email provider key.
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    logApiError('config', 'method_not_allowed');
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseAnonKey = (
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ''
    ).trim();

    const secretKey = (
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
    ).trim();

    // Safety check: the browser key must be present and must never equal the server key.
    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      (secretKey && supabaseAnonKey === secretKey) ||
      supabaseAnonKey.startsWith('sb_secret_')
    ) {
      logApiError('config', 'missing_or_invalid_public_supabase_configuration');
      return res.status(500).json({ error: 'Public authentication configuration is unavailable.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      supabaseUrl,
      supabaseAnonKey
    });
  } catch (error) {
    logApiError('config', error);
    return res.status(500).json({ error: 'Public authentication configuration is unavailable.' });
  }
}
