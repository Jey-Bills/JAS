-- Phase 13: server-side login rate limits.
-- Run in Supabase Dashboard → SQL Editor → New query before deploying the login change.
-- The browser sends only an email address; the API hashes email + client IP. Raw identifiers
-- are never stored. The server calls the RPC with the service-role key.

-- Preserve the existing authenticated owner policies, but ensure the public/anon roles
-- cannot reach the two existing tables through either a grant or a broad policy.
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.enquiries FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon;

DO $$
DECLARE
  unsafe_policy record;
BEGIN
  FOR unsafe_policy IN
    SELECT pol.polname, tbl.relname
    FROM pg_catalog.pg_policy AS pol
    JOIN pg_catalog.pg_class AS tbl ON tbl.oid = pol.polrelid
    JOIN pg_catalog.pg_namespace AS nsp ON nsp.oid = tbl.relnamespace
    WHERE nsp.nspname = 'public'
      AND tbl.relname IN ('enquiries', 'rate_limits')
      AND (
        0::oid = ANY(pol.polroles)
        OR EXISTS (
          SELECT 1
          FROM pg_catalog.unnest(pol.polroles) AS assigned_role(role_oid)
          JOIN pg_catalog.pg_roles AS grantee ON grantee.oid = assigned_role.role_oid
          WHERE grantee.rolname = 'anon'
        )
      )
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON public.%I',
      unsafe_policy.polname,
      unsafe_policy.relname
    );
  END LOOP;
END;
$$;

-- Narrow the existing table policies to the one approved owner account. This keeps
-- a future authenticated account from inheriting enquiry access if it is ever added.
DROP POLICY IF EXISTS "enquiries_select_authenticated" ON public.enquiries;
CREATE POLICY "enquiries_select_authenticated"
  ON public.enquiries
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'jessenyarko192@gmail.com'
  );

DROP POLICY IF EXISTS "enquiries_update_authenticated" ON public.enquiries;
CREATE POLICY "enquiries_update_authenticated"
  ON public.enquiries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'jessenyarko192@gmail.com'
  )
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'jessenyarko192@gmail.com'
  );

DROP POLICY IF EXISTS "rate_limits_select_authenticated" ON public.rate_limits;
CREATE POLICY "rate_limits_select_authenticated"
  ON public.rate_limits
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND lower(coalesce((SELECT auth.jwt() ->> 'email'), '')) = 'jessenyarko192@gmail.com'
  );

CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash text NOT NULL UNIQUE,
  count integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  window_start timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS auth_rate_limits_window_start_idx
  ON public.auth_rate_limits (window_start);

-- No browser role may read or change login counters. service_role bypasses RLS and is
-- granted the table/function access needed by /api/auth/check-rate-limit.
REVOKE ALL ON TABLE public.auth_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.auth_rate_limits TO service_role;

-- Ensure the new table has no policies, including any created manually before this script.
DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT pol.polname
    FROM pg_catalog.pg_policy AS pol
    JOIN pg_catalog.pg_class AS tbl ON tbl.oid = pol.polrelid
    JOIN pg_catalog.pg_namespace AS nsp ON nsp.oid = tbl.relnamespace
    WHERE nsp.nspname = 'public'
      AND tbl.relname = 'auth_rate_limits'
  LOOP
    EXECUTE pg_catalog.format(
      'DROP POLICY %I ON public.auth_rate_limits',
      existing_policy.polname
    );
  END LOOP;
END;
$$;

-- One atomic upsert protects simultaneous login requests from bypassing the limit.
-- Attempts 1–5 are allowed; attempt 6 and later are blocked until the 15-minute window ends.
CREATE OR REPLACE FUNCTION public.consume_auth_login_rate_limit(p_identifier_hash text)
RETURNS TABLE (allowed boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_count integer;
  v_window_start timestamptz;
  v_allowed boolean;
  v_retry_after integer;
BEGIN
  IF p_identifier_hash IS NULL OR p_identifier_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid login rate-limit identifier';
  END IF;

  -- Remove expired hashed identifiers during normal use so old pairs are not kept forever.
  DELETE FROM public.auth_rate_limits
  WHERE window_start <= v_now - interval '15 minutes';

  INSERT INTO public.auth_rate_limits AS current_limit
    (identifier_hash, count, window_start)
  VALUES
    (p_identifier_hash, 1, v_now)
  ON CONFLICT (identifier_hash) DO UPDATE
  SET count = CASE
        WHEN current_limit.window_start <= v_now - interval '15 minutes' THEN 1
        ELSE current_limit.count + 1
      END,
      window_start = CASE
        WHEN current_limit.window_start <= v_now - interval '15 minutes' THEN v_now
        ELSE current_limit.window_start
      END
  RETURNING count, window_start INTO v_count, v_window_start;

  v_allowed := v_count <= 5;
  v_retry_after := CASE
    WHEN v_allowed THEN 0
    ELSE GREATEST(
      1,
      CEIL(EXTRACT(epoch FROM (v_window_start + interval '15 minutes' - v_now)))::integer
    )
  END;

  RETURN QUERY SELECT v_allowed, v_retry_after;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_auth_login_rate_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_login_rate_limit(text) TO service_role;

COMMENT ON TABLE public.auth_rate_limits IS
  'Short-lived login counters keyed by a SHA-256 hash of normalized email and client IP.';

-- Optional audit queries. Run after the migration and confirm:
-- 1. relrowsecurity is true for auth_rate_limits.
-- 2. The policy query returns zero rows for auth_rate_limits.
-- 3. The policy query shows no anon or public policies on enquiries/rate_limits.
SELECT tbl.relname AS table_name, tbl.relrowsecurity AS rls_enabled
FROM pg_catalog.pg_class AS tbl
JOIN pg_catalog.pg_namespace AS nsp ON nsp.oid = tbl.relnamespace
WHERE nsp.nspname = 'public'
  AND relation.relname IN ('enquiries', 'rate_limits', 'auth_rate_limits')
ORDER BY relation.relname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('enquiries', 'rate_limits', 'auth_rate_limits')
ORDER BY tablename, policyname;
