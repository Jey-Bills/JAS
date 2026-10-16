# Handover — Jey's Academic Studio

This handover is for the studio owner and the person maintaining the website. It describes the Phase 13 source changes and the steps needed before they become live.

## Release status

- **Repository:** https://github.com/Jey-Bills/JAS
- **Production URL:** https://jas-olive.vercel.app/
- **Hosting:** Vercel deploys the connected GitHub `main` branch.
- **Current release:** Phases 1–12 are reported as merged and live.
- **Phase 13:** These changes are on the existing work branch until the owner reviews and merges its pull request. They are not live just because the files are present in the branch.
- **Before merging Phase 13:** Run `supabase/phase13-auth-rate-limits.sql` in the correct Supabase project, then follow `TESTING.md` on the Vercel preview. Do not deploy the login change before the SQL function exists; the login check is designed to stop sign-in if protection is unavailable.

The future domain `jeyacademichub.com` has not been purchased or connected. See `DOMAIN_SWAP.md` when that changes.

## What is built

### Public website

The public site is made from plain HTML, CSS and browser JavaScript. It includes the studio's home, service, pricing, process, about, FAQ, contact and privacy pages, plus a custom 404 page. Prices and shared contact data come from `js/data.js`; relevant page copy and contact fallbacks are in HTML. There is no frontend framework or build step.

The public enquiry form is on https://jas-olive.vercel.app/contact.html. Its copy, prices and layout were not changed in Phase 13. The public contact inbox is intentionally shown as a business contact on public pages; it is not prefilled, hinted at or displayed on the owner sign-in page.

### Enquiries, email and attachments

- `POST /api/submit` validates enquiry fields and uses the existing Supabase enquiry rate limit before saving.
- Enquiries are stored in `public.enquiries`.
- Optional uploaded files use the private Supabase Storage bucket `enquiry-files`; the current form has limits and accepted file types documented in `TESTING.md`.
- Resend sends a notification to the studio inbox from `JAS Enquiries <onboarding@resend.dev>`. The sender domain is still in test mode. The existing notification does not send a customer confirmation email.
- If the enquiry is saved but an upload or email step fails, the handler can still return success with a warning. Check Supabase and the Vercel function log before asking a customer to submit the same enquiry again.

### Owner dashboard

The owner sign-in page is https://jas-olive.vercel.app/jas-hub/login.html. The dashboard is https://jas-olive.vercel.app/jas-hub/.

The dashboard supports searching, filtering, sorting, enquiry details and private file downloads. The owner can update enquiry status and internal notes, export the filtered results to CSV, and apply a status to selected enquiries. Enquiry reads and permitted changes use the browser's public Supabase key and the signed-in owner session; RLS enforces access.

The page folder is `jas-hub/`. The separate `/api/admin/` server route remains in place for signed downloads. It verifies the Supabase session token server-side, checks the owner account and checks that the requested file is still listed on the enquiry. The old static `/admin/` route intentionally returns 404 without redirecting.

### Phase 13 security changes

- Vercel sends a Content Security Policy, MIME-sniffing protection, frame protection, referrer and permissions policies, and HSTS.
- The policy allows the required local files, Supabase services, Supabase JavaScript CDN, Google Fonts and Unsplash image. Inline scripts and inline style attributes were removed instead of allowing `unsafe-inline`.
- The sign-in page's email input starts blank and has no owner-email hint. The client-side owner check remains; the sign-in page itself does not display the owner address.
- Before Supabase password sign-in, the page calls `/api/auth/check-rate-limit`. The server hashes the normalized email and client IP and atomically counts attempts in a 15-minute window. Attempts one through five are allowed; the sixth is blocked. A failed server check stops sign-in.
- Serverless errors use structured, redacted JSON log lines with a request ID. Request bodies, uploaded files, secrets and signed URLs are not logged.
- `supabase/phase13-auth-rate-limits.sql` creates the `auth_rate_limits` table and `consume_auth_login_rate_limit` function. It keeps RLS enabled, removes public/anon policies on the existing enquiry tables, and restricts authenticated policies to the studio owner.

## RLS audit

After the Phase 13 SQL is applied, the expected RLS policies are:

| Table | Policy | Command | Allowed role and check |
| --- | --- | --- | --- |
| `public.enquiries` | `enquiries_select_authenticated` | SELECT | `authenticated`; only a session whose verified email claim matches the approved owner email. |
| `public.enquiries` | `enquiries_update_authenticated` | UPDATE | `authenticated`; the same owner check in both `USING` and `WITH CHECK`. SQL grants still limit updates to `status`, `notes` and `file_paths`. |
| `public.rate_limits` | `rate_limits_select_authenticated` | SELECT | `authenticated`; only the approved owner email. |
| `public.auth_rate_limits` | None | — | RLS is enabled; there are no policies. Browser roles have no table access; the server-side `service_role` uses the RPC and bypasses RLS. |

There should be **no `anon` or `PUBLIC` policies and no anon table privileges** on `enquiries` or `rate_limits`. There are no anon INSERT, SELECT, UPDATE or DELETE policies. The Phase 13 SQL includes a query to list the live policies. The repository does not have a connection to inspect the Supabase production database directly, so the owner must run the SQL and review its results before calling the live RLS state verified.

The original Phase 10 script used a general non-null authenticated-user condition. The Phase 13 migration replaces those three policies with an explicit owner email check while preserving the Phase 10 column grants. If another policy was added manually in Supabase, the audit query will show it; remove it only after checking with the maintainer.

## Environment and account safety

The Vercel project needs these names, with one of each alternative pair:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` — server-side only
- `SUPABASE_ANON_KEY` or `SUPABASE_PUBLISHABLE_KEY` — browser-safe public key, protected by RLS
- `RESEND_API_KEY` — server-side only

Values belong in Vercel's environment-variable settings or an ignored local environment file. Never commit a populated `.env` file, put a server key in `js/`, or share keys in chat. `.env.example` is blank and contains no real key.

Public signups should stay disabled in Supabase Auth. There should be one approved studio-owner account. Do not create additional authenticated users without first reviewing the owner-only RLS policies.

## What's pending

- [ ] Apply and review `supabase/phase13-auth-rate-limits.sql` in the correct Supabase project.
- [ ] Review the Phase 13 pull request and automated test results; merge it into `main` only after the database step and Preview checks are complete.
- [ ] On the deployed release, check the security headers, the new owner URLs and the old-path 404.
- [ ] Complete the live enquiry form, owner sign-in, dashboard actions and attachment-download checks in `TESTING.md`.
- [ ] Continue using the existing Vercel URL until the future domain is purchased and configured.
- [ ] Verify a sending domain with Resend before changing the current sender address.
- [ ] Review the draft privacy notice against actual data handling and applicable Ghanaian requirements before describing it as final.
- [ ] Confirm the studio's record-retention and deletion process. There is no automatic database or Storage cleanup job.
- [ ] Real Android/iPhone testing remains the owner's responsibility.

## What was deliberately not built

- No customer accounts, public signup, password reset flow or new dashboard features.
- No online payments or automated customer confirmation emails.
- No new analytics, tracking or third-party dependency.
- No malware scanner or automatic enquiry/file-retention cleanup.
- No custom domain purchase or DNS changes.
- No verified Resend sender domain. Resend currently uses its test sender and the existing owner inbox as recipient.
- No new public write policy. The enquiry API uses server-side credentials; the browser does not get the service-role key.

## Future improvements to consider

Only plan these with the owner and test them separately:

1. Buy and connect `jeyacademichub.com`, verify it in Vercel and Resend, then follow `DOMAIN_SWAP.md`.
2. Set up a monitored mailbox or forwarding for the chosen public email address; a verified sending domain alone does not create an inbox.
3. Agree and document an enquiry/file retention period, then consider a reviewed automatic cleanup process.
4. Consider an additional sign-in safeguard such as multi-factor authentication if Supabase configuration and the owner's workflow support it.
5. Revisit backup and recovery steps with the Supabase/Vercel account owners.

## Owner runbooks

- `README.md` — project structure, editing, hosting, environment and SQL setup.
- `TESTING.md` — pre-launch and post-deploy checks with exact commands and URLs.
- `MONTHLY_CHECKLIST.md` — routine maintenance.
- `DOMAIN_SWAP.md` — future domain and email transition.
