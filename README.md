# Jey's Academic Studio — Website

A multi-page enquiry-first website for an academic support and research guidance service in Ghana. Built with plain HTML, CSS and JavaScript. No build step, no backend, no accounts.

## Quick start

1. Download and unzip the project folder (or clone it).
2. Double-click **index.html** to open it in your browser.
3. That's it — no installation, terminal commands or build tools.

Keep the folders together. Internet access is needed for Google Fonts, the Unsplash homepage photo, and opening WhatsApp. Without internet, the site still uses a system font and a navy hero background. JavaScript needs to be enabled to display prices, open the mobile menu and prepare a brief.

## Project structure

```text
jey-academic-studio/
├── index.html
├── services.html
├── pricing.html
├── how-it-works.html
├── about.html
├── faq.html
├── contact.html
├── privacy.html
├── 404.html
├── sitemap.xml
├── robots.txt
├── README.md
├── HANDOVER.md
├── TESTING.md
├── css/
│   └── styles.css
├── js/
│   └── data.js
├── assets/
│   └── favicon.svg
└── services/
    ├── assignments-presentations.html
    ├── research-support.html
    ├── bsn-case-studies.html
    ├── editing-formatting.html
    ├── assignments-presentations/
    │   ├── word-assignments.html
    │   └── powerpoint.html
    ├── research-support/
    │   ├── diagnostic-review.html
    │   ├── technical-support.html
    │   └── end-to-end.html
    ├── bsn-case-studies/
    │   ├── comprehensive.html
    │   └── complex.html
    └── editing-formatting/
        ├── light.html
        ├── moderate.html
        └── substantial.html
```

There are **23 HTML files**, including the 404 error page. The sitemap lists the 22 main pages; the error page is deliberately excluded.

## How to edit content

Use a plain-text editor. Save a copy before editing and refresh the browser after saving. There is nothing to compile.

### Changing prices

Open **js/data.js** and look for `pricing`. Every displayed price table and price card reads from this list. Each row has a `min`, `max`, `scope` and `status`. Change the numbers, save the file and refresh any page. A starting price uses `from: true` and `max: null`.

For example, `min: 40, max: 80` displays **GH₵40–80** in a price card. Do not put currency symbols inside the numbers. Keep IDs and group names unchanged.

The minimum postgraduate assignment charge is calculated from the postgraduate bands. Policy wording is in the `policy` object in the same file.

**There are no hardcoded visible price tables to synchronise.** A few search-engine descriptions mention price ranges; review those descriptions in the relevant HTML files when changing prices so search snippets stay accurate. Status badges are part of the HTML: if you change a status, update its badge class and wording wherever that service appears, too.

### Changing contact details

The contact object in **js/data.js** supplies the running site's labelled contact details and links wherever `data-contact-*` attributes are present, including WhatsApp messages prepared by the form.

Also update the readable fallback links and text in the HTML files, so details remain correct when JavaScript is unavailable:

- The footer of every page.
- The floating WhatsApp button on every page.
- contact.html (the direct contact cards).
- privacy.html, about.html and documentation.
- CTA bands on all pages.

The header **Request a Quote** button links to contact.html; it does not contain a phone number.

Search the project for `233534423173`, `0534423173`, `0205243731` and `jessenyarko192@gmail.com` to find existing references. WhatsApp links need the international number, without a plus sign or leading zero. Telephone links use the domestic number.

### Changing the brand name or tagline

The confirmed brand is **Jey's Academic Studio**. Search for `JAS`, `Jey's Academic Studio`, `Jey’s Academic Studio`, and the tagline across the project. The brand appears in headers, footers, page copy, metadata, messages and the favicon. Keep the spelling consistent.

### Changing service descriptions

Edit the prose in the relevant HTML page. The `services` array in js/data.js is also available for reuse and must be kept in line with the HTML wording if service names or categories change. Pricing is rendered from the data file; ordinary page prose is stored in HTML.

### Changing the hero background image

Open **css/styles.css** and find the `.hero` rule. Replace its background URL with your own image, for example `url('../assets/library.jpg')`. Keep the navy gradient before the image URL. Use a wide, licensed image at least 2000px wide, optimised for the web.

Only the homepage uses the photo background. If you replace the photo, also update the `og:image` URL in each HTML file for social sharing. Social images need an absolute URL on your live domain.

### Replacing the JAS text logo with an image logo

Save your logo in assets/jas-logo.png. In each header, replace the `<span class="brand-mark">…</span>` with an image using `alt="JAS"` and `class="brand-logo"`. Use the correct path:

- Root pages: `assets/jas-logo.png`.
- Category pages: `../assets/jas-logo.png`.
- Sub-service pages: `../../assets/jas-logo.png`.

Add `.brand-logo { height: 38px; width: auto; }` to css/styles.css. A transparent-background logo works best. Keep the readable brand name beside it.

### Shared navigation and footer

Every page has the same header and footer pattern, with paths adjusted for its folder depth. They are written directly into HTML so the website works without a server or page-fetching scripts. If you change the navigation structure or footer copy, apply that change across all 23 HTML files.

## Deployment

First confirm your real domain. **jaysacademic.studio is an unconfirmed domain used for the canonical, Open Graph, sitemap and robots URLs.** It is not a change to the confirmed brand spelling. Search and replace that domain throughout the HTML, sitemap.xml and robots.txt before publishing on your own domain.

Keep index.html at the top of the published folder. If you only deploy the website files, omit these three Markdown documents to keep internal handover notes out of public view.

### Option A — Netlify manual deploy (recommended for a first launch)

1. Go to netlify.com and create or sign in to your account.
2. Choose the manual/drag-and-drop deployment option (often called Netlify Drop).
3. Drag the **unzipped jey-academic-studio folder containing index.html** into the deploy area.
4. Open the live address provided by Netlify and run TESTING.md against it.
5. If using a custom domain, add it through your site's domain-management settings and follow the DNS instructions.
6. For updates, open the same site's Deploys area and upload the revised folder. Starting a separate drop may create a new site instead of updating the existing one.

Netlify's usual static hosting behaviour recognises a root 404.html. Verify a nonexistent address after deployment. Free plans and dashboard labels can change; review the provider's current terms. No contact-form service is used.

### Option B — Vercel

Use Vercel's Git-repository import workflow, or its deployment CLI if you are comfortable with that. Select **Other** as the framework, use the folder containing index.html as the project root, and do not add a build command. Set the output directory to the project root (`.`) if requested. Review the current static-hosting instructions in the dashboard. Vercel is not assumed to support Netlify-style folder drag-and-drop.

Test routes and the 404 response after deployment; a custom 404 may need provider-specific configuration. No deployment configuration is bundled in this plain-file MVP.

### Option C — GitHub Pages

1. Put the contents of jey-academic-studio at the root of a GitHub repository.
2. In repository Settings → Pages, select deployment from a branch.
3. Select your main branch and the root folder.
4. Wait for publication, open the supplied URL and test it.

If the site is published under `/repository-name/`, include that prefix when updating canonical and sitemap URLs. Ordinary site links are relative and already work under a subfolder. Check how your provider handles the nested paths on a custom 404 response.

## Backend setup

Beginning with Phase 8, the quote request form on `contact.html` submits briefs directly to a Vercel serverless endpoint (`/api/submit`), which validates and stores enquiries in Supabase and sends email notifications via Resend. WhatsApp and email handoff links remain available as fallbacks.

### Required accounts

- **Vercel** — hosts the static frontend and serverless functions in `/api/*.js` (all functions use a 30-second `maxDuration`, configured in `vercel.json` via the single `api/*.js` glob to accommodate file uploads in `/api/submit`).
- **Supabase** — PostgreSQL database storing `enquiries` and enforcing IP-based submission rate limits via `rate_limits` and `consume_enquiry_rate_limit`.
- **Resend** — sends transactional email notifications when a new enquiry arrives.

### Environment variables

Configure the following environment variables in your Vercel project settings (and in a local `.env` file if testing with Vercel CLI — never commit `.env` to Git; see `.env.example`):

- `SUPABASE_URL` — your Supabase project URL (`https://<project-ref>.supabase.co`).
- `SUPABASE_SECRET_KEY` — your Supabase service role / secret key (used server-side only in `/api/submit`; falls back to `SUPABASE_SERVICE_ROLE_KEY`). Never expose this key in browser code.
- `SUPABASE_ANON_KEY` — your Supabase public anon/publishable key (used browser-side for `/admin` authentication with RLS enabled; falls back to `SUPABASE_PUBLISHABLE_KEY`).
- `RESEND_API_KEY` — your Resend API key (`re_...`).

### Database setup (Supabase SQL)

In the Supabase Dashboard, open **SQL Editor → New query** and run the Phase 8 schema script to create:

1. The `public.enquiries` table (`id`, `created_at`, `name`, `email`, `phone`, `level`, `service`, `title`, `description`, `length`, `deadline`, `existing_draft`, `preferred_contact`, `notes`, `status`, `user_agent`, `ip_hash`).
2. The `public.rate_limits` table and `public.consume_enquiry_rate_limit(p_ip_hash text)` function returning `(allowed boolean, retry_after integer)`.
3. Permissions revoked from `anon` and `authenticated` and granted only to `service_role`.

### File uploads

Phase 9 supports optional attachments through `/api/submit` using multipart/form-data. JSON-only enquiries still work. File bytes pass through the server; the browser never uploads directly to Supabase. No new dependencies or environment variables are needed. Node's built-in Web Request/FormData parser requires Node 20+ (use a currently supported Vercel Node runtime, e.g. Node 22).

**Before merging**, run [`supabase/phase9-file-uploads.sql`](supabase/phase9-file-uploads.sql) in Supabase SQL Editor:

```sql
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS file_paths jsonb DEFAULT NULL;
```

- **Bucket:** `enquiry-files`, private (**Public must remain OFF**). Do not add public/anon/authenticated insert or read policies. Only the backend uses the secret/service-role key. Confirm existing Storage policies do not grant these roles access to this bucket. RLS/table permissions from Phase 8 are unchanged.
- **Limits:** max 3 files; original per-file ceiling 5 MB, but the **combined total is limited to 4,000,000 bytes (4 MB)**, as approved by the owner. The effective single-file limit is therefore also 4 MB. This leaves room below Vercel's 4.5 MB request-body cap. The complete request is bounded to 4,064,000 bytes. Larger requests may be rejected by Vercel before our function runs; use WhatsApp/email instead.
- **Types:** PDF, DOC, DOCX, PPT, PPTX, JPG/JPEG, PNG, ZIP. Both the filename extension and declared MIME type must match on the server (ZIP accepts `application/zip` and `application/x-zip-compressed`). Empty files are rejected. This is not virus scanning or verification of the actual binary format; only open trusted files and do not upload patient-identifying information. Browsers that supply an empty/generic MIME type will be rejected; use the fallback instead.
- **Paths:** `enquiries/<server-generated-enquiry-UUID>/<server-generated-file-UUID>-<sanitized-name>`. Original filenames are sanitized and length-limited. Metadata in `enquiries.file_paths` is an array of `{path, name, size, type}`; no file bytes or signed URLs are stored in the table.
- **Downloads:** owner notification emails contain signed links expiring after 604,800 seconds (7 days). The bucket is never made public. Anyone holding a signed URL can use it until expiry; do not forward links. Supabase's owner dashboard can download files after email links expire. No admin download UI is included in this phase.
- **Failure handling:** validation returns `400` before any database/storage writes. The existing honeypot and rate limit still apply. The enquiry is saved before upload attempts. Failed uploads/metadata saves return `200` with a warning displayed in the confirmation panel and owner email, and fallbacks remain available. Metadata failures trigger best-effort file removal. Signing failures are identified in the owner email; files stay recorded privately. External Supabase calls have short timeouts and a shared budget; Resend also has a timeout. There is no automatic retry that could duplicate a saved enquiry.
- **Retention:** keep attachments only as long as needed for agreed work; delete on request. No automatic retention deletion job is implemented.

**View/download/delete:** Supabase Dashboard → **Storage → enquiry-files → enquiries → [full enquiry UUID]**. Match that UUID to the row in **Table Editor → enquiries**. Select an object to download or delete it using dashboard actions. After deleting, remove its metadata entry from `file_paths` (or set the column to `NULL` when deleting all attachments). Existing signed links stop working when the corresponding object is deleted. If a request times out or cleanup fails, check the enquiry's folder for unreferenced files and remove them manually. If a timed-out metadata update actually completed before cleanup, clear any stale metadata pointing to deleted objects.

**Phase 9 live checks** (after SQL + merge + successful Vercel deployment):

1. Open `https://jas-olive.vercel.app/contact.html`. Attach a small PDF and PNG, complete the required fields, send. Expect selected filenames/sizes and removal controls, **Uploading files…**, then a confirmation with a reference.
2. In Supabase, verify the row's `file_paths` metadata and matching private Storage objects. In the owner inbox / Resend Emails, open each signed download link. Confirm expiry is configured at 7 days and the email still has the client's Reply-To.
3. Remove a selected file and confirm it is absent from the sent request/metadata. Try four files, a `.txt` file, an empty file, and files totalling over 4 MB: expect an immediate error and no request until corrected. The WhatsApp fallback remains usable.
4. Submit without files. Browser DevTools → Network should show JSON, HTTP `200`, and the existing success flow; Supabase `file_paths` should be `NULL`.
5. Confirm **Public OFF** and no public access policies. An unsigned `/storage/v1/object/public/enquiry-files/<path>` URL must not download the file. Inspect DevTools Network: uploads only go to `/api/submit`, and no service-role key appears in browser code or requests.
6. Open `https://jas-olive.vercel.app/privacy.html` and verify the storage/retention note. If submission fails, inspect `/api/submit`'s status/response in DevTools and Vercel Function logs. For `500`, check the SQL migration, env var names, table grants, and bucket ID. For `400`, check fields, extension/MIME and size. For `429`, wait for the rate-limit period; do not repeatedly retry. For a saved-enquiry attachment warning, keep the reference and send missing files via WhatsApp/email instead of resubmitting the enquiry.

**Maintainer regression tests:** `npm ci && node --test tests/*.test.js`. Tests use built-in Node tools and mocked Supabase/Resend responses; they do not validate actual production credentials, deployed Storage policies, or email delivery.

### Admin authentication (Phase 10)

Phase 10 adds a protected studio-owner sign-in flow at `/admin/login.html` and a protected dashboard shell at `/admin/` (`/admin/index.html`) using Supabase Auth with the public anon/publishable key.

- **SQL setup:** Run [`supabase/phase10-admin-auth.sql`](supabase/phase10-admin-auth.sql) in the Supabase SQL Editor to enable Row Level Security (RLS) on `public.enquiries` and `public.rate_limits`, grant `authenticated` `SELECT` and column-restricted `UPDATE (status, notes, file_paths)` on `public.enquiries` (and `SELECT` on `public.rate_limits`), and keep `anon` blocked while preserving `service_role` access for `/api/submit`.
- **Client configuration:** `js/supabase-client.js` reads `window.JAS_CONFIG` (`js/config.js`) or fetches `/api/config`, which exposes only `SUPABASE_URL` and `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEY`) — never the secret/service-role key.
- **Rate limiting:** `js/admin-auth.js` enforces a 15-minute client-side lockout in `localStorage` after 5 consecutive failed sign-in attempts within 15 minutes.

### Test flow

1. Deploy the branch to Vercel (or merge the pull request into `main`).
2. Open `/contact.html` on the deployed Vercel site.
3. Fill in all required fields on the **Or send a brief** form and click **Send brief**.
4. Verify the button shows **Sending…** and the form is replaced by the confirmation panel:
   *"Brief received. Thanks [name]. You'll hear back at [preferred_contact] typically within a few hours. Reference: [8-char reference]."*
5. In **Supabase → Table Editor → `enquiries`**, confirm the new row appears with `status = 'new'`.
6. In **jessenyarko192@gmail.com** (and **Resend → Emails**), confirm the notification email arrived from `JAS Enquiries <onboarding@resend.dev>` with `Reply-To` set to the client's email address.

### Known limitation — Resend test mode

No custom sending domain is verified yet. While Resend is in test mode:

- Emails can **only** be sent from `JAS Enquiries <onboarding@resend.dev>` **to** `jessenyarko192@gmail.com`.
- Automated confirmation emails to clients cannot be sent until the production domain (`jeyacademichub.com`) is purchased and verified in Resend.
- If Resend fails or hits a quota limit after Supabase has saved the enquiry, `/api/submit` logs a warning and still returns HTTP `200` so no student enquiry is ever lost.

## Testing before launch

See **TESTING.md** for the owner checklist and the build-verification record. Real Android/iPhone handoffs and the final deployed site's behaviour still need your testing.

## Known limits

- No user accounts, admin panel, payment processing or analytics yet.
- Enquiries and optional attachments submit to the backend; WhatsApp/email handoffs are alternatives and require sending in the chosen app. Selecting Call records a callback preference; it does not place a call automatically.
- Attachments are capped at 3 files and 4 MB combined; larger files must be shared via WhatsApp/email. No malware scanning or automatic retention cleanup is provided.
- No payment processing. Payment terms are agreed in the quote.
- Long mailto messages may exceed an email app's limits. Use WhatsApp or direct email if that happens.
- Google Fonts and the homepage photo are remote resources. System-font and navy-background fallbacks remain usable if those resources fail.
- Prices need JavaScript. Service prose, navigation links, contact links and native FAQ accordions remain readable without it; the mobile toggle needs JavaScript.
- The favicon is SVG. Some Apple devices may not use an SVG touch icon; add a suitable PNG touch icon later if needed.
- Local files cannot test a host's HTTP 404 handling. Verify the actual hosted response before launch.
- The privacy notice is an explicitly labelled draft, not legal advice or a compliance certification.

## Support

For technical launch questions, contact the person maintaining the site. For business questions, contact Jesse Nyarko at **jessenyarko192@gmail.com** or WhatsApp **0534423173**.
