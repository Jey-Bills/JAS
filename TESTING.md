# Test checklist — Jey's Academic Studio

Use this checklist before the Phase 13 release and again after the owner merges the pull request into `main`. The live site is https://jas-olive.vercel.app/. A Vercel Preview URL is better for testing a new release, but it normally uses the same Supabase project unless Preview environment variables point elsewhere.

**Important:** the contact-form test creates a real database enquiry and sends a real owner notification. Use your own harmless test details and remove the test enquiry/file afterward under the studio's agreed retention process. Do not enter patient-identifying details, bank details, passwords or real client information into a test.

## 1. Run the automated tests

From the repository folder, run:

```sh
npm ci
node --test tests/*.test.js
```

All tests should finish with `# fail 0`. They use mocked Supabase and Resend responses. They do not contact production, apply SQL, verify Vercel headers, or send an email.

## 2. Check the deployed site and security headers

Open a terminal and copy these commands. They only read the site; they do not submit an enquiry:

```sh
curl -sSI https://jas-olive.vercel.app/
```

Expect an HTTP success response and these headers: `content-security-policy`, `x-content-type-options: nosniff`, `x-frame-options: DENY`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: geolocation=(), microphone=(), camera=()`, and `strict-transport-security: max-age=31536000`.

Check the main routes and the removed route:

```sh
for path in / /contact.html /jas-hub/login.html /jas-hub/ /admin/; do
  printf '%-24s ' "$path"
  curl -sS -o /dev/null -w '%{http_code}\n' "https://jas-olive.vercel.app$path"
done
```

Expected results: `/`, `/contact.html`, `/jas-hub/login.html` and `/jas-hub/` return `200`; `/admin/` returns `404`. The former path must not redirect to the new one. If you also want to check the no-slash address, run:

```sh
curl -sS -o /dev/null -w '%{http_code}\n' https://jas-olive.vercel.app/admin
```

Expect `404`.

The dashboard HTML is a static file, so its initial HTTP request may return `200` even when no one is signed in. The page must then send an unauthenticated browser to the sign-in page, and Supabase RLS must refuse dashboard data. A `200` from `curl` alone does not prove a user is signed in.

Check that the API is present without changing data:

```sh
curl -sS -o /dev/null -w 'submit GET: %{http_code}\n' https://jas-olive.vercel.app/api/submit
curl -sS -o /dev/null -w 'rate-limit GET: %{http_code}\n' https://jas-olive.vercel.app/api/auth/check-rate-limit
```

Both should return `405` (these endpoints accept POST only). Do not paste the output of `/api/config` into a public message; it intentionally contains the public browser key.

## 3. Check the public site (Phases 1–7)

Open https://jas-olive.vercel.app/ and visit each of these pages:

- https://jas-olive.vercel.app/services.html
- https://jas-olive.vercel.app/pricing.html
- https://jas-olive.vercel.app/how-it-works.html
- https://jas-olive.vercel.app/about.html
- https://jas-olive.vercel.app/faq.html
- https://jas-olive.vercel.app/contact.html
- https://jas-olive.vercel.app/privacy.html

For each page, check that:

- [ ] It loads without a blank screen or browser security warning.
- [ ] Navigation links open the expected pages and the logo goes to the home page.
- [ ] Prices use **GH₵** and match the approved current price list. Do not edit prices as part of a security test.
- [ ] The mobile navigation opens and closes; keyboard users can reach its controls.
- [ ] The page fits a phone screen without unwanted sideways scrolling.
- [ ] The hero image and Google Font load, or the existing fallback is used if a remote service is unavailable.
- [ ] The floating WhatsApp link opens the intended WhatsApp chat. Phone and email links open the device's expected app.
- [ ] The privacy notice is still marked as a draft until it has been reviewed and approved.

Check a normal missing page and a nested missing page:

```sh
curl -sS -o /dev/null -w 'missing top-level page: %{http_code}\n' https://jas-olive.vercel.app/not-a-real-page
curl -sS -o /dev/null -w 'missing nested page: %{http_code}\n' https://jas-olive.vercel.app/not-a-real-folder/not-a-real-page
```

Both should return HTTP `404`. In a browser, confirm the custom 404 page has working links back to the home and services pages.

## 4. Test the Phase 8 enquiry form end-to-end

This is a real submission. Use a test name, an email address you control, a phone number you can recognise, and a harmless description. Do not include client or sensitive information.

1. Open https://jas-olive.vercel.app/contact.html.
2. Complete every required field. Use a valid date, choose an existing-draft answer and a contact preference, and tick the consent box.
3. First leave one required field blank and choose **Send brief**. The form should show a clear field error and should not create an enquiry.
4. Complete the required fields and send the harmless test brief without a file. The page should show its success message and reference.
5. In Supabase, open **Table Editor → `enquiries`**. Confirm one new row exists with `status = new` and the details you entered.
6. Check the studio inbox and **Resend → Emails** for the notification. The current sender is `JAS Enquiries <onboarding@resend.dev>` and the recipient is the studio inbox. The client's address should be the Reply-To.
7. Sign in at the owner page and confirm the enquiry appears in the dashboard. Remove or archive the test record according to the studio's approved process.

If an HTTP error appears, check **Vercel → JAS project → Logs** using the time of your test and the request ID shown in the structured error entry. Do not retry repeatedly: a saved enquiry may already exist even if a later email or file step had a problem.

## 5. Test the Phase 9 file upload

1. Open https://jas-olive.vercel.app/contact.html.
2. Complete a harmless test brief and attach one small PDF (under 4 MB). If available, repeat with a small PNG in a separate test.
3. Confirm the selected file name appears before sending, then send once and wait for the result.
4. In Supabase, confirm the enquiry row has file metadata and the matching object is inside the **private** `enquiry-files` bucket.
5. In the dashboard, open the enquiry and use its download action. Confirm the file downloads.
6. Confirm the bucket is not public. An unauthenticated public-object URL must not expose the file.
7. Remove the test enquiry and its test file only after confirming the retention/deletion process. There is no automatic cleanup job.

The form allows no more than three files and 4 MB combined; each file must be 5 MB or smaller and use an accepted type shown on the form. A rejected file should show a clear message before it is submitted. Do not upload a real client's document for testing.

## 6. Check Supabase RLS and run the Phase 13 migration

Before testing the new login limiter, the owner must run `supabase/phase13-auth-rate-limits.sql` in **Supabase Dashboard → SQL Editor → New query → Run**. This migration creates the login-limit table and RPC, keeps RLS enabled, removes any `PUBLIC`/`anon` policies from `enquiries` and `rate_limits`, and replaces their authenticated policies with an owner-email check. Do not deploy the Phase 13 login change before this step is complete.

After the migration, run these read-only queries in SQL Editor:

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

Expect RLS to be enabled for all three tables. Expect the three authenticated policies `enquiries_select_authenticated`, `enquiries_update_authenticated` and `rate_limits_select_authenticated`, each restricted to the approved owner email. Expect **zero policies** for `auth_rate_limits`, and no policy role named `anon` or `public` for `enquiries` or `rate_limits`. If the results differ, stop and ask the maintainer to review them; do not add a public policy.

## 7. Test the Phase 10–13 sign-in and dashboard

### Sign-in and privacy

1. Open https://jas-olive.vercel.app/jas-hub/login.html in a private/incognito browser window.
2. Confirm the email box is empty on load, has no placeholder, and has no owner-email hint. Type the existing owner email yourself.
3. In browser Developer Tools → **Network**, submit once. Confirm `POST /api/auth/check-rate-limit` completes with `allowed: true` before the Supabase password sign-in request begins.
4. Sign in using the owner's existing Supabase Auth password. Never write the password into this file or a chat message.
5. Confirm the browser reaches https://jas-olive.vercel.app/jas-hub/ and the signed-in owner email is shown only inside the authenticated dashboard.
6. Use **Logout**. Confirm the browser returns to the sign-in page.

The client-side lockout is only a convenience. The server check must block a request even if local browser storage is cleared. Do not deliberately make repeated wrong-password attempts with the owner's real account on production; that will lock it for 15 minutes.

### Safe server rate-limit test

This test sends no password and does not need a Supabase user. Use a fresh email address that you control but that is not the owner's sign-in address. The address is hashed with your network's IP; the raw email is not stored in the counter table. Replace the value below before running the loop:

```sh
TEST_EMAIL='replace-with-an-email-you-control@example.com'
for attempt in 1 2 3 4 5 6; do
  printf 'Attempt %s: ' "$attempt"
  curl -sS -o /dev/null -w '%{http_code}\n' \
    -X POST https://jas-olive.vercel.app/api/auth/check-rate-limit \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$TEST_EMAIL\"}"
done
```

For a fresh email/IP pair, attempts 1–5 should return `200`; attempt 6 should return `429`. Use the same network for all six calls. Do not repeat the test with the same email until 15 minutes have passed. If the migration is missing or the database is unavailable, the endpoint should return `503`; sign-in must not proceed.

### Dashboard and Phase 11–12 actions

While signed in, test with a harmless test enquiry:

- [ ] Enquiry counts and rows load. Search, status/service filters, sorting, date range and load-more work.
- [ ] Open the detail panel. Confirm fields and attachments correspond to the selected row.
- [ ] Change a status inline and in the detail panel; refresh and confirm the change remains.
- [ ] Add a private note, save, refresh and confirm it remains. Clear a non-empty note and confirm the warning appears first.
- [ ] Filter the list and export CSV. Open the downloaded CSV and confirm it contains only the filtered results.
- [ ] Select more than one test row and use the bulk status action. Confirm the action before applying it and then refresh.
- [ ] Download an attachment. In Network, verify the `/api/admin/signed-url` request is authenticated. Do not copy or share the temporary signed link.
- [ ] Log out and confirm the dashboard content is no longer shown.

## 8. Check the Phase 13 error logging and secret handling

When a test produces a controlled error, open Vercel **Logs** and confirm the entry is one JSON line with `endpoint`, `error`, `timestamp` and `request_id`. Logs must not contain a full request body, password, server key, file content or signed URL. Client-visible errors should remain short and must not show a stack trace or database details.

The public configuration endpoint is meant to return a project URL and public browser key only. Server-side secret keys and the email API key must never appear in browser files, DevTools page source or network responses.

## 9. Phone, keyboard and content checks (all phases)

- [ ] Repeat the home, service, pricing and contact checks at a narrow phone width and on a real Android/iPhone if available.
- [ ] Use Tab, Shift+Tab, Enter and Space to navigate. Confirm visible focus, the skip link and usable form errors.
- [ ] Zoom the browser to 200% and check the content remains usable.
- [ ] Turn on reduced motion in the device/browser and confirm animations are reduced.
- [ ] Confirm the supplied prices, service scope, contact numbers and availability wording are still owner-approved.
- [ ] Confirm no unapproved testimonials, qualifications, statistics or outcome promises were introduced.
- [ ] Confirm all currency uses **GH₵**.
- [ ] Confirm the privacy notice remains accurate and is not described as legally approved until it has been reviewed.

## 10. Release sign-off

- [ ] Automated tests pass: `node --test tests/*.test.js`.
- [ ] Supabase Phase 13 SQL has run successfully; audit query results match Section 6.
- [ ] Vercel Preview shows the requested headers and the CSP does not block fonts, the Supabase client, the hero image or dashboard actions.
- [ ] `/jas-hub/login.html` and `/jas-hub/` load; unauthenticated browser access redirects to sign-in.
- [ ] The former `/admin/` route returns 404 and does not redirect.
- [ ] Public enquiry without a file and enquiry with a small test file both work end-to-end.
- [ ] Owner sign-in, dashboard changes, notes, CSV and private download work.
- [ ] The owner reviewed the Preview and approves merging the pull request into `main`.

No Phase 13 live-browser or production database check is claimed complete by the source-code test suite. Record each real check above only after the owner has performed it.
