# Monthly maintenance checklist

Use this once a month. Check a box only after you have completed the task. The live site is https://jas-olive.vercel.app/.

## Website and hosting

- [ ] Open https://jas-olive.vercel.app/ and https://jas-olive.vercel.app/contact.html. Check that both load and links work.
- [ ] Open https://jas-olive.vercel.app/jas-hub/login.html and confirm the email field is blank. Do not share the owner's password.
- [ ] In Vercel, open the JAS project → **Deployments**. Confirm the latest production deployment succeeded and came from the intended `main` commit.
- [ ] Open Vercel → JAS project → **Logs**. Review recent function errors and investigate any repeated failures. Logs should have a request ID and must not contain passwords, full request bodies, file contents or signed links.
- [ ] If code changed, in the repository folder run `npm ci` followed by `node --test tests/*.test.js`.

## Supabase and enquiries

- [ ] Sign in to the correct Supabase project. Confirm the `enquiries` table and private `enquiry-files` bucket are available.
- [ ] In **SQL Editor**, run the read-only check below. Confirm RLS is enabled on all three tables, the three owner-only policies are present on `enquiries` and `rate_limits`, and `auth_rate_limits` has no policies.
- [ ] Confirm the `enquiry-files` bucket is still private. Do not enable public access.
- [ ] Review stored enquiries and files against the studio's approved retention/deletion process. No automatic cleanup is configured; remove data only under that process and check for unlinked files.
- [ ] Check that the owner can sign in, view an enquiry and download a permitted attachment. Do not repeatedly test wrong passwords on the production account.

Copy this read-only query into **Supabase → SQL Editor → New query → Run**:

```sql
SELECT relation.relname AS table_name,
       relation.relrowsecurity AS rls_enabled
FROM pg_catalog.pg_class AS relation
JOIN pg_catalog.pg_namespace AS schema ON schema.oid = relation.relnamespace
WHERE schema.nspname = 'public'
  AND relation.relname IN ('enquiries', 'rate_limits', 'auth_rate_limits')
ORDER BY relation.relname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('enquiries', 'rate_limits', 'auth_rate_limits')
ORDER BY tablename, policyname;
```

Expected policy names: `enquiries_select_authenticated`, `enquiries_update_authenticated`, and `rate_limits_select_authenticated`; all must be restricted to the approved owner. `auth_rate_limits` must have **zero** policies. Stop and ask the maintainer if you see an `anon` or `public` role, a missing table, or RLS disabled. Do not fix it by adding a public policy.

## Email, contact and records

- [ ] Confirm the current owner inbox can receive notifications. Resend is still using its test sender until a custom domain is verified.
- [ ] Confirm the contact numbers and inbox shown on the public site are still correct. Public contact details are intentional; no owner address is shown on the sign-in form.
- [ ] Check whether any enquiries or files should be removed under the studio's actual retention policy. Do not invent a retention period or keep records longer than the policy allows.
- [ ] Keep Supabase and Vercel account access limited to people who need it. Never put environment-variable values in Git, email, screenshots or chat.
- [ ] If `jeyacademichub.com` has been purchased, follow `DOMAIN_SWAP.md` before changing DNS or the email sender.

## Record for next month

- Date checked: ____________________
- Person checking: ____________________
- Items needing follow-up: ______________________________________________
