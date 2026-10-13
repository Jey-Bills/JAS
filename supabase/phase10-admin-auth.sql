-- Phase 10: Admin Authentication & Row Level Security (RLS)
-- Run this script in the Supabase SQL Editor BEFORE testing Phase 10 on the live site.

-- 1. Enable Row Level Security on enquiries and rate_limits
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- 2. Ensure anon (public) has NO table-level privileges on enquiries or rate_limits
REVOKE ALL ON TABLE public.enquiries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC, anon, authenticated;

-- 3. Preserve full access for service_role (used server-side by /api/submit)
GRANT ALL ON TABLE public.enquiries TO service_role;
GRANT ALL ON TABLE public.rate_limits TO service_role;

-- 4. Grant authenticated users (the studio owner) SELECT and column-restricted UPDATE
GRANT SELECT ON TABLE public.enquiries TO authenticated;
GRANT UPDATE (status, notes, file_paths) ON TABLE public.enquiries TO authenticated;
GRANT SELECT ON TABLE public.rate_limits TO authenticated;

-- 5. RLS Policies for public.enquiries (authenticated owner only; no anon policies)
DROP POLICY IF EXISTS "enquiries_select_authenticated" ON public.enquiries;
CREATE POLICY "enquiries_select_authenticated"
  ON public.enquiries
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "enquiries_update_authenticated" ON public.enquiries;
CREATE POLICY "enquiries_update_authenticated"
  ON public.enquiries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- 6. RLS Policy for public.rate_limits (authenticated owner read-only; no anon policies)
DROP POLICY IF EXISTS "rate_limits_select_authenticated" ON public.rate_limits;
CREATE POLICY "rate_limits_select_authenticated"
  ON public.rate_limits
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
