/**
 * Public Supabase configuration endpoint for browser-side Auth (/admin).
 * Returns ONLY the project URL and public anon/publishable key from environment variables.
 * Never exposes SUPABASE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, or RESEND_API_KEY.
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

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

  // Safety check: ensure the public key is present and is never identical to the secret key
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    (secretKey && supabaseAnonKey === secretKey) ||
    supabaseAnonKey.startsWith('sb_secret_')
  ) {
    console.error('Missing or invalid public Supabase configuration (SUPABASE_URL / SUPABASE_ANON_KEY).');
    return res.status(500).json({ error: 'Public authentication configuration is unavailable.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
}
