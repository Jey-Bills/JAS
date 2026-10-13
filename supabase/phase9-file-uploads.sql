-- Run in Supabase SQL Editor BEFORE merging/deploying Phase 9.
-- Existing Phase 8 permissions remain unchanged. No Storage policies/public access added.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS file_paths jsonb DEFAULT NULL;

COMMENT ON COLUMN public.enquiries.file_paths IS
  'Optional private Storage attachments: array of {path, name, size, type}. No signed URLs stored.';
