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

- **Vercel** — hosts the static frontend and serverless functions in `/api/*.js` (configured in `vercel.json` with a 10-second `maxDuration`).
- **Supabase** — PostgreSQL database storing `enquiries` and enforcing IP-based submission rate limits via `rate_limits` and `consume_enquiry_rate_limit`.
- **Resend** — sends transactional email notifications when a new enquiry arrives.

### Environment variables

Configure the following environment variables in your Vercel project settings (and in a local `.env` file if testing with Vercel CLI — never commit `.env` to Git; see `.env.example`):

- `SUPABASE_URL` — your Supabase project URL (`https://<project-ref>.supabase.co`).
- `SUPABASE_SECRET_KEY` — your Supabase service role / secret key (used server-side only in `/api/submit`; falls back to `SUPABASE_SERVICE_ROLE_KEY`). Never expose this key in browser code.
- `RESEND_API_KEY` — your Resend API key (`re_...`).

### Database setup (Supabase SQL)

In the Supabase Dashboard, open **SQL Editor → New query** and run the Phase 8 schema script to create:

1. The `public.enquiries` table (`id`, `created_at`, `name`, `email`, `phone`, `level`, `service`, `title`, `description`, `length`, `deadline`, `existing_draft`, `preferred_contact`, `notes`, `status`, `user_agent`, `ip_hash`).
2. The `public.rate_limits` table and `public.consume_enquiry_rate_limit(p_ip_hash text)` function returning `(allowed boolean, retry_after integer)`.
3. Permissions revoked from `anon` and `authenticated` and granted only to `service_role`.

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

- No backend, database, user accounts, admin panel or analytics.
- The form prepares a message only. It does not submit data to a server.
- After preparing the brief, the visitor must choose WhatsApp or email and then send it in their app. Selecting Call records a callback preference; it does not place a call automatically.
- No file uploads. Files are shared by WhatsApp or email after the initial quote is confirmed.
- No payment processing. Payment terms are agreed in the quote.
- Long mailto messages may exceed an email app's limits. Use WhatsApp or direct email if that happens.
- Google Fonts and the homepage photo are remote resources. System-font and navy-background fallbacks remain usable if those resources fail.
- Prices need JavaScript. Service prose, navigation links, contact links and native FAQ accordions remain readable without it; the mobile toggle needs JavaScript.
- The favicon is SVG. Some Apple devices may not use an SVG touch icon; add a suitable PNG touch icon later if needed.
- Local files cannot test a host's HTTP 404 handling. Verify the actual hosted response before launch.
- The privacy notice is an explicitly labelled draft, not legal advice or a compliance certification.

## Support

For technical launch questions, contact the person maintaining the site. For business questions, contact Jesse Nyarko at **jessenyarko192@gmail.com** or WhatsApp **0534423173**.
