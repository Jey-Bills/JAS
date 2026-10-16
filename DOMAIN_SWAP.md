# Future domain and email change guide

This guide is for the future move from the Vercel address to **jeyacademichub.com**. That domain has not been purchased yet. Do not make DNS changes or change the email sender until the domain is owned, verified and tested.

Current website: https://jas-olive.vercel.app/

## Before you start

- [ ] The owner has purchased `jeyacademichub.com` from a domain registrar and can sign in to that registrar.
- [ ] The owner can sign in to the JAS project in Vercel: https://vercel.com/dashboard.
- [ ] The owner can sign in to the Resend account: https://resend.com/domains.
- [ ] Decide whether `jeyacademichub.com` or `www.jeyacademichub.com` will be the main website address. The other can be set to redirect to it.
- [ ] Decide whether `hello@jeyacademichub.com` will be a working inbox or forward to an inbox the owner checks. Resend verifies a sender domain; it does **not** automatically create a mailbox.
- [ ] Keep the current Vercel domain available until both website and email checks pass.

Do not send passwords, DNS account access codes or API keys to anyone in chat or in a Git commit.

## Part A — connect the website to Vercel

1. Sign in at https://vercel.com/dashboard and open the JAS project.
2. Open **Settings → Domains**.
3. Add `jeyacademichub.com`. Add `www.jeyacademichub.com` too if you want both addresses.
4. Vercel will show the DNS records needed for this project. In the domain registrar's DNS page, copy **the exact record type, name and value shown by Vercel**. Do not guess an IP address or copy an old value from another project.
5. Do not delete existing email/MX records while adding the website records. DNS changes can take time to appear.
6. Return to Vercel → **Settings → Domains**. Wait until the domain shows as configured and HTTPS is ready. Choose the primary domain and redirect the other website hostname if Vercel offers that option.
7. Test both addresses in a browser. The primary one must open over `https://` without a certificate warning.

If Vercel says a record is wrong, use the current values shown in that project's Domains screen. Do not publish a guessed record.

## Part B — update the site's canonical website address

The site currently contains the previous unconfirmed canonical domain `jaysacademic.studio` in page metadata, the sitemap and robots file. After Vercel has verified the new domain:

1. Open the project in a text editor that has **Find in Files** (for example, VS Code).
2. Search only in `*.html`, `sitemap.xml` and `robots.txt` for `https://jaysacademic.studio`.
3. Replace those occurrences with `https://jeyacademichub.com` (or the `www` version if that is the chosen primary address). Update the `robots.txt` sitemap URL to the final sitemap address on the chosen domain.
4. Check the result from a terminal in the repository:

   ```sh
   git grep -n 'jaysacademic.studio' -- '*.html' sitemap.xml robots.txt
   ```

   No output is expected for those site files. If output remains, inspect it before release; do not blindly replace unrelated documentation.

5. Run the automated tests:

   ```sh
   npm ci
   node --test tests/*.test.js
   ```

6. Review `git diff`, open a pull request into `main`, and let the owner merge it. Vercel deploys the approved change from `main`.

The page links and API calls are mostly relative, so `/api/submit`, `/api/config`, `/api/auth/check-rate-limit` and `/api/admin/signed-url` should stay on the same host. Do not rename `/api/admin/` when changing the public domain.

## Part C — verify the sending domain in Resend

1. Sign in at https://resend.com/domains and choose **Add domain**.
2. Enter `jeyacademichub.com` and follow Resend's current setup screen.
3. Resend will display DNS records for domain verification and email authentication. Copy the exact values into the registrar's DNS page.
4. Keep any existing MX and SPF records used for the owner's current email. If a new SPF record would duplicate an existing one, stop and ask the email provider or maintainer how to combine it; do not publish two SPF records for the same domain.
5. Return to Resend and wait until the domain's verification status is successful.
6. Confirm a mailbox or forwarding rule exists for `hello@jeyacademichub.com` if it will be shown as a contact address. Sending-domain verification by itself does not make that address receive mail.

Do not change the application sender while Resend still shows the domain as unverified.

## Part D — change the sender and privacy contact

Only after Resend verifies `jeyacademichub.com`:

1. In `api/submit.js`, change the sender line from:

   ```js
   from: 'JAS Enquiries <onboarding@resend.dev>',
   ```

   to:

   ```js
   from: 'JAS Enquiries <hello@jeyacademichub.com>',
   ```

2. Keep the existing `to` recipient and `replyTo` behaviour unless the owner separately approves changing where notifications go. The notification currently goes to the studio inbox, and its Reply-To is the customer's address.
3. Review `privacy.html`. If the owner has made `hello@jeyacademichub.com` a monitored contact address, update the privacy contact text and mail link to that address. If it is not monitored, keep the currently monitored contact address instead. Review the whole notice against the actual providers, retention and deletion process; keep it labelled as a draft until it has been reviewed and approved.
4. If the new address is also replacing the public business inbox, update `js/data.js` and all plain-HTML contact fallbacks together. Do not change only one footer or one page.
5. Run `npm ci && node --test tests/*.test.js`, review the diff, and send the changes through a pull request into `main`.

## Part E — end-to-end test after deployment

Use your own harmless test enquiry. Do not use a client's information or a real project file.

1. Check the website and headers:

   ```sh
   curl -sSI https://jeyacademichub.com/
   ```

   Expect a successful HTTPS response and the Phase 13 security headers.

2. Open https://jeyacademichub.com/contact.html and submit one complete harmless test enquiry with one small PDF attachment.
3. Confirm the page shows a success reference, the enquiry appears in Supabase, and the test file is in the private `enquiry-files` bucket.
4. Confirm the notification reaches the configured studio inbox and is sent from `JAS Enquiries <hello@jeyacademichub.com>`.
5. Confirm Reply-To is still the email address entered for the test enquiry.
6. Sign in at https://jeyacademichub.com/jas-hub/login.html and download the test attachment from the dashboard.
7. Confirm https://jeyacademichub.com/admin/ returns `404` and does not redirect. The API path `/api/admin/signed-url` remains unchanged.
8. Remove the test enquiry and file only according to the approved retention/deletion process.

If a website check fails, set the Vercel primary domain back to the previous working hostname and use the DNS values Vercel currently provides. If email fails, restore the sender line to `JAS Enquiries <onboarding@resend.dev>` and redeploy while the owner investigates Resend. Do not remove email DNS records as a rollback shortcut.
