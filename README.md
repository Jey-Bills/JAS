# Jey's Academic Studio — website and backend

Jey's Academic Studio is a plain HTML, CSS and JavaScript website with a Vercel serverless backend. It has no frontend framework and no build step. The public site is enquiry-first; the private dashboard is for the studio owner.

## Important links

- **Live public site:** https://jas-olive.vercel.app/
- **Owner sign-in:** https://jas-olive.vercel.app/jas-hub/login.html
- **Owner dashboard:** https://jas-olive.vercel.app/jas-hub/
- **Public enquiry form:** https://jas-olive.vercel.app/contact.html
- **Privacy notice:** https://jas-olive.vercel.app/privacy.html
- **Repository:** https://github.com/Jey-Bills/JAS

The owner page lives in `/jas-hub/`. Its server-side attachment API remains at `/api/admin/signed-url`; these are different paths for different purposes. The page address is not a security barrier: Supabase sign-in, server-side checks and row-level security protect the data. The former `/admin/` page address returns **404** and does not redirect or reveal the replacement path.

## Open the site on your computer

To preview the public pages without installing anything:

1. Download or clone the repository.
2. Open a terminal in the `JAS` folder.
3. Run `python3 -m http.server 8000`.
4. Open http://localhost:8000/ in a browser.
5. Stop the local server with **Ctrl+C** in the terminal.

On Windows, `py -m http.server 8000` can be used instead of `python3 -m http.server 8000`.

This simple preview only serves files. It does **not** run `/api/` endpoints, so it cannot test submissions, sign-in or downloads. Use a Vercel Preview deployment or the live site for those checks. The deployed 404 page also uses the site's root paths; the local preview is intended for the regular pages.

## Run the automated checks

With Node.js installed, run these exact commands from the repository folder:

```sh
npm ci
node --test tests/*.test.js
```

The tests use mock responses. They check code paths but do not connect to the live Supabase project, send real Resend email, or prove that production DNS or Vercel settings are correct. There is no `npm run build` command.

## Project map

```text
JAS/
├── index.html, about.html, contact.html, faq.html, how-it-works.html
├── pricing.html, privacy.html, services.html, 404.html
├── services/                  Service and sub-service pages
├── jas-hub/
│   ├── login.html             Owner sign-in page
│   └── index.html             Owner dashboard page
├── css/
│   ├── styles.css             Public website styles
│   └── admin.css              Dashboard and sign-in styles
├── js/
│   ├── data.js                Public contact data, prices and form behaviour
│   ├── config.js              Browser-safe public configuration
│   ├── supabase-client.js     Browser Supabase client using a public key only
│   ├── admin-auth.js          Owner sign-in/session checks and local UX limit
│   └── admin-dashboard.js     Search, filters, status, notes, CSV and downloads
├── api/
│   ├── submit.js              Public enquiry submission and optional uploads
│   ├── config.js              Returns only public Supabase settings
│   ├── auth/check-rate-limit.js Server-side login-attempt check
│   └── admin/signed-url.js    Owner-verified private download URL
├── lib/api-error-logger.js    Small, redacting structured error logger
├── supabase/                  SQL scripts for existing setup and Phase 13
├── tests/                     Automated Node.js tests
├── vercel.json                Vercel routes and HTTP security headers
├── .env.example               Blank environment-variable template; no real keys
├── HANDOVER.md
├── TESTING.md
├── MONTHLY_CHECKLIST.md
└── DOMAIN_SWAP.md
```

## Editing the public website

Make a copy of a file before changing it. This is a static site; save the file and refresh the browser to view an edit.

- **Prices and shared contact data:** `js/data.js`. Keep currency formatted as **GH₵**. Price status wording and supporting page copy are also present in the relevant HTML pages; review them together if the owner approves a price change.
- **Service descriptions and page wording:** the matching HTML file under the project root or `services/`.
- **Colours, type and layout:** `css/styles.css`.
- **Owner sign-in/dashboard:** `jas-hub/`, `js/admin-auth.js`, `js/admin-dashboard.js` and `css/admin.css`. Do not put a server-side key in any of these browser files.
- **Public contact fallbacks:** contact details also appear as plain HTML so they still work when JavaScript is unavailable. If an approved public contact changes, update `js/data.js` and the matching HTML fallbacks together.

The public inbox address is intentionally displayed on the public website as a business contact. It is not displayed or prefilled on the owner sign-in page. Do not treat a public contact address as a password or secret.

## Backend and hosting

Vercel serves the HTML, CSS and browser JavaScript, and runs the files under `api/` as serverless endpoints. A merge into `main` triggers the connected Vercel deployment. There is no framework or generated output directory.

### What each endpoint does

- `POST /api/submit` checks the enquiry, applies the existing enquiry rate limit, saves it in Supabase, uploads allowed optional attachments to the private `enquiry-files` bucket, and asks Resend to notify the owner. A saved enquiry remains saved if the email or attachment service has a temporary problem.
- `GET /api/config` returns only the Supabase project URL and public anon/publishable key. It never returns a server-side key.
- `POST /api/auth/check-rate-limit` receives an email address before password sign-in. On the server it combines the normalized email with the client IP, hashes the pair, and asks Supabase to allow up to five attempts in a 15-minute window. The sixth attempt is blocked. If the rate-limit service is unavailable, sign-in is stopped rather than allowed through.
- `POST /api/admin/signed-url` checks the Supabase session token with Supabase Auth, checks that the account is the studio owner, confirms that the file still belongs to the enquiry, and returns a short-lived download URL. Never rename the `/api/admin/` endpoint when changing the page folder.

The browser dashboard reads and updates enquiries through Supabase using the public key and the signed-in user's session. RLS controls those database requests. The service-role/secret key is used only by server-side functions.

### Environment variables in Vercel

In the Vercel dashboard, open the JAS project, then **Settings → Environment Variables**. Add the variables below to the required **Production** and **Preview** environments. Use the names exactly as shown; enter values directly in Vercel, not in Git or chat.

| Variable | Use |
| --- | --- |
| `SUPABASE_URL` | Project URL from Supabase. |
| `SUPABASE_SECRET_KEY` **or** `SUPABASE_SERVICE_ROLE_KEY` | Server-side access for privileged operations. Keep private; set one of these names. |
| `SUPABASE_ANON_KEY` **or** `SUPABASE_PUBLISHABLE_KEY` | Public browser key. It is safe to expose only because RLS remains enabled. Set one of these names. |
| `RESEND_API_KEY` | Server-side email sending. |

After changing an environment variable, redeploy the Vercel project so the functions receive the new value. `.env.example` contains blank placeholders only. A real `.env` file is ignored by Git; never add it to a commit.

### Supabase setup and Phase 13 SQL

The live project already has the Phase 8 `enquiries` and `rate_limits` tables and the `consume_enquiry_rate_limit` function. The original Phase 8 schema script is not included in this repository. If you are creating a new Supabase project, ask the maintainer for that original script before continuing; do not guess the schema.

For an existing project, use the Supabase dashboard:

1. Sign in to the correct Supabase project.
2. Open **SQL Editor → New query**.
3. Open each script listed below in a text editor, copy its full contents into the SQL Editor and choose **Run**.
4. Keep a note of which scripts have been run.

Run the scripts in this order when setting up a project:

1. The original Phase 8 schema and `consume_enquiry_rate_limit` script (obtain it from the maintainer; it is not in this checkout).
2. `supabase/phase9-file-uploads.sql` to add attachment metadata. The bucket must remain private; do not turn on public access.
3. `supabase/phase10-admin-auth.sql` to enable RLS and grant the owner the dashboard permissions.
4. `supabase/phase13-auth-rate-limits.sql` **before deploying Phase 13**. It creates the hashed login counter and atomic database function, removes any `PUBLIC`/`anon` policies from `enquiries` and `rate_limits`, and narrows the authenticated policies to the approved owner email. It leaves `auth_rate_limits` with RLS enabled and no policies; the server-side service role is the only application role granted access.

The Phase 13 login endpoint depends on the database function `public.consume_auth_login_rate_limit(text)`. If the migration has not run or Supabase cannot reach it, the login page fails closed and reports that sign-in protection is unavailable.

### Row-level security (RLS)

After the Phase 13 SQL has run, the expected policies are:

| Table | Policy | Who and what it allows |
| --- | --- | --- |
| `public.enquiries` | `enquiries_select_authenticated` | The approved owner account can read enquiries. |
| `public.enquiries` | `enquiries_update_authenticated` | The approved owner account can update only the database columns granted by the Phase 10 SQL (`status`, `notes`, `file_paths`). |
| `public.rate_limits` | `rate_limits_select_authenticated` | The approved owner account can read the existing enquiry counters. |
| `public.auth_rate_limits` | **No policies** | RLS is enabled; browser roles have no table/function access. The server-side `service_role` calls the function. |

There are no `anon` or `PUBLIC` policies on `enquiries` or `rate_limits`, and no anon write access. The Phase 13 migration includes SQL queries that list the current RLS state. Compare those results with this table after running it. Do not add a public policy to make a browser request work.

### Email delivery limitation

The current sender is `JAS Enquiries <onboarding@resend.dev>`. Resend is in test mode and the notification is sent only to the studio inbox. It is not a verified custom sending domain, and the customer does not receive an automated confirmation email. Read `DOMAIN_SWAP.md` before changing the sender.

### HTTP security headers and monitoring

`vercel.json` applies a Content Security Policy and the requested browser security headers to the site and API routes. The policy allows the local site, Supabase, the Supabase realtime WebSocket, the Supabase JavaScript library CDN, Google Fonts and the Unsplash hero photo. HTML has no inline script or style attributes, so the policy does not use `unsafe-inline`.

The four serverless endpoints write short JSON error entries to Vercel function logs with an endpoint name, a redacted error label/message, a timestamp and a request ID. They do not log full request bodies, file contents, secrets or signed download URLs. Check **Vercel → JAS project → Logs** when investigating an error; do not paste credentials into a support request.

## Release steps

1. Run `npm ci && node --test tests/*.test.js` from the repository folder.
2. Apply `supabase/phase13-auth-rate-limits.sql` in the correct Supabase project before deploying this phase.
3. Open and review the pull request from the existing session branch into `main`.
4. The owner merges the pull request; Vercel then deploys from `main`.
5. Follow `TESTING.md` on the Vercel deployment and confirm the form, sign-in, dashboard and file download flow.

Do not push directly to `main`. Do not publish this release before the database migration is complete.

## Related guides

- `HANDOVER.md` — what is built, pending and intentionally not included.
- `TESTING.md` — copy-ready checks for the public site, form, admin and security.
- `MONTHLY_CHECKLIST.md` — routine care for the owner.
- `DOMAIN_SWAP.md` — steps for a future move to `jeyacademichub.com` and verified Resend sending.
