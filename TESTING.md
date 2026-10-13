# Pre-launch testing checklist

Use this list on your **actual deployed website**, not only the preview. Keep the boxes unchecked until you personally complete them. The automated checks performed during this build are recorded separately at the end.

## Open every page

- [ ] index.html loads.
- [ ] services.html loads.
- [ ] services/assignments-presentations.html loads.
- [ ] services/research-support.html loads.
- [ ] services/bsn-case-studies.html loads.
- [ ] services/editing-formatting.html loads.
- [ ] services/assignments-presentations/word-assignments.html loads.
- [ ] services/assignments-presentations/powerpoint.html loads.
- [ ] services/research-support/diagnostic-review.html loads.
- [ ] services/research-support/technical-support.html loads.
- [ ] services/research-support/end-to-end.html loads.
- [ ] services/bsn-case-studies/comprehensive.html loads.
- [ ] services/bsn-case-studies/complex.html loads.
- [ ] services/editing-formatting/light.html loads.
- [ ] services/editing-formatting/moderate.html loads.
- [ ] services/editing-formatting/substantial.html loads.
- [ ] pricing.html loads.
- [ ] how-it-works.html loads.
- [ ] about.html loads.
- [ ] faq.html loads.
- [ ] contact.html loads.
- [ ] privacy.html loads.
- [ ] 404.html loads directly.
- [ ] A made-up top-level URL displays the 404 page and sends an HTTP 404 response.
- [ ] A made-up nested URL also displays a styled 404 page whose links work.

Local file opening does not test a hosting provider's 404 handling. The 404 page is prepared for a site hosted at the domain root; if you publish under a repository subfolder, check the host's 404 setup and adjust the hosted base/asset paths if needed.

## Test navigation

- [ ] Every header nav link goes to the correct page, including from nested pages.
- [ ] The active nav item is highlighted. Services stays highlighted on all category and sub-service pages.
- [ ] Privacy and 404 do not incorrectly highlight an unrelated nav item.
- [ ] The hamburger menu opens and closes on a phone-width window.
- [ ] The menu button announces its expanded/collapsed state.
- [ ] Escape closes the menu and returns focus to the menu button.
- [ ] Breadcrumbs on category and sub-service pages work at every linked level.
- [ ] Footer links work on every page.
- [ ] The header Request a Quote button goes to contact.html on every page.
- [ ] The floating WhatsApp button appears on every page.

There is no separate header WhatsApp link in the specified design. The header quote button opens Contact, where WhatsApp is available. Test the actual CTA, footer and floating WhatsApp links instead.

## Test contact

- [ ] The floating WhatsApp button opens the correct number with its prefilled quote message.
- [ ] WhatsApp links open in a new tab/app as appropriate for your device.
- [ ] The Contact WhatsApp card opens the correct number.
- [ ] Each service-specific Discuss/Request quote link has an appropriate prefilled message.
- [ ] Both footer telephone links open the dialler on mobile with the correct number.
- [ ] The footer email link opens your email app at the correct address.
- [ ] CTA WhatsApp, call and email buttons work on root and nested pages.

## Test the enquiry form

- [ ] Empty submit shows errors under all 10 required field groups.
- [ ] The first invalid field receives focus.
- [ ] A whitespace-only name is rejected.
- [ ] An invalid email shows “Please enter a valid email address.”
- [ ] An invalid phone number shows the phone error.
- [ ] A short description (less than 20 characters) shows the description error.
- [ ] Missing level, service, deadline, draft choice, contact preference and consent all show their specified errors.
- [ ] A valid brief shows the panel with two sending options.
- [ ] The panel clearly says “Your brief is ready. Choose how to send it — nothing has been sent yet.”
- [ ] Preparing the brief does not open an app automatically or move you to another page.
- [ ] Send via WhatsApp opens the app/site with all message fields filled correctly.
- [ ] Send via Email opens the email app with the subject and the same message content.
- [ ] Optional blank title, length and notes appear as “—”.
- [ ] WhatsApp and email messages have a blank line between every field for readability.
- [ ] Choosing Call records that preference in the brief; you can still send it using WhatsApp or email.
- [ ] Changing any field after preparation hides the old panel so you cannot accidentally send stale details.
- [ ] Try a long brief on your own email app. If it cannot open, use WhatsApp or direct email.
- [ ] No enquiry data appears in localStorage or sessionStorage (DevTools → Application → Storage).
- [ ] Clicking Prepare my brief makes no network request (DevTools → Network; clear the list after page resources finish loading).
- [ ] With JavaScript disabled, the preparation button is disabled and the direct contact alternatives remain available.

Do not send real patient-identifying data, bank details or other sensitive information in your test brief. Preparing a brief does not send it. To complete an end-to-end test, deliberately send a harmless test message from the app and confirm receipt yourself.

## Test on mobile

- [ ] Open the deployed website on a real Android phone.
- [ ] Open it on a real iPhone.
- [ ] Text is readable without zooming.
- [ ] No page-level horizontal scrolling; any wide price table scrolls inside its own box.
- [ ] Buttons and the header are easy to tap.
- [ ] The floating WhatsApp button does not prevent access to important controls.
- [ ] The menu works in portrait and landscape.
- [ ] Form fields, especially the date picker and selects, work on your phone.
- [ ] The keyboard does not make required form controls unreachable.
- [ ] Telephone, WhatsApp and email app handoffs work on both phones.

## Test accessibility

- [ ] Tab through each page with the keyboard and reach every link, button and form field.
- [ ] Gold focus rings are visible.
- [ ] The skip-to-content link appears when first tabbing into the page.
- [ ] Pressing Enter on the skip link moves focus to the main content.
- [ ] FAQ answers open and close with Enter/Space on their summaries.
- [ ] Check the form labels and errors with a screen reader if possible.
- [ ] Every actual image has suitable alt text; decorative SVGs are hidden from assistive technology.
- [ ] Colour contrast is readable, including helper and error text.
- [ ] With your device's reduced-motion setting enabled, pulsing/animated effects stop.
- [ ] Zoom the browser to 200% and verify content stays usable.

Automated accessibility tests help catch common issues, but they are not a complete accessibility audit or certification.

## Content and pricing

- [ ] All 30 supplied price rows match what you charge.
- [ ] Prices use GH₵ throughout.
- [ ] Confirmed, provisional, target and individual-quote labels are correct.
- [ ] The complex BSN range is marked provisional and individually quoted.
- [ ] A concise pricing note appears in the hero of every page displaying price tables or cards; repeated body/footer disclaimers are absent.
- [ ] Urgency, payment and revision wording are approved.
- [ ] No invented testimonials, credentials, awards, statistics or outcome guarantees appear.
- [ ] No assessed-work ghostwriting is implied.
- [ ] 24/7 availability and typical reply-time wording are accurate for your service.
- [ ] Approve the About bio and remove the pre-launch wording note once approved.
- [ ] No unfinished sample copy remains. The domain and privacy review notices are intentional launch tasks, not claims of readiness.

## Deployment-ready

- [ ] Replace jaysacademic.studio with your real domain in canonical and Open Graph URLs.
- [ ] sitemap.xml uses your real domain and includes the 22 main pages, excluding 404.html.
- [ ] robots.txt points to the correct live sitemap URL.
- [ ] The favicon appears on your browsers. If needed, add a PNG Apple touch icon for iOS.
- [ ] The homepage photo loads, is suitable and can be used under its applicable licence/terms.
- [ ] The privacy notice has been reviewed against Ghanaian data-protection requirements and actual studio practices.
- [ ] The site works on HTTPS.
- [ ] All app handoffs have been tested on real phones.
- [ ] Keep HANDOVER.md and TESTING.md out of the published folder if these notes should not be public.
- [ ] After the final deploy, refresh the live site and repeat key checks to avoid relying on an older cached version.

## Build verification record — 13 October 2026

The following were tested using automated Chromium browser checks and file inspection, not merely assumed:

- [x] All 23 HTML files opened through a local preview server and directly through file://.
- [x] All 23 pages were checked at **320, 375, 640, 768, 880, 960 and 1440px** preview widths, with no page-level horizontal overflow.
- [x] Direct file opening was additionally checked at 375 and 1440px.
- [x] Every static internal link, resource path and anchor resolved to an existing target.
- [x] Every page had one H1, a valid heading sequence, language, encoding, viewport and unique metadata.
- [x] All 30 price rows and their statuses matched the supplied specification; all tables/cards rendered from window.JAS_DATA.
- [x] All four badge colour combinations matched the specified values.
- [x] The mobile menu opened/closed by button; Escape closed it and restored focus.
- [x] The first keyboard Tab reached the homepage skip link; Enter moved focus to main.
- [x] Reduced-motion emulation disabled the availability pulse animation.
- [x] All 11 current FAQ accordions were present; keyboard opening/closing was exercised.
- [x] Empty form submission produced all 10 required error groups and focused the first invalid field.
- [x] Invalid email, phone and short-description errors matched the required wording.
- [x] Valid preparation showed the honest panel; both encoded messages contained all 12 message fields and were identical.
- [x] Form preparation made zero network requests, opened no new window and created zero local/session storage entries.
- [x] Editing a prepared form removed stale sending links; optional blanks used em dashes.
- [x] The form also prepared successfully in direct file mode.
- [x] With JavaScript disabled, the form's preparation button remained disabled, preventing accidental native submission.
- [x] The floating WhatsApp button was visible on all pages at every tested width.
- [x] Google Fonts and the exact Unsplash homepage image loaded during preview checks.
- [x] No JavaScript exceptions, normal-page console errors or failed resource requests were recorded in the final functional test run.
- [x] The preview returned the custom, styled 404 page for a nested missing URL, with working root links. The browser's expected HTTP 404 report is not a JavaScript error.
- [x] Sitemap: 22 valid main-page entries dated 2026-10-13; robots.txt points to the specified sitemap URL.
- [x] Automated axe-core checks for WCAG 2 A/AA and WCAG 2.1 AA reported **zero violations on all 23 pages at desktop and mobile widths**, and in the contact form's error/ready states after a contrast fix.
- [x] Site content was checked for invented credentials/testimonials/guarantees, wrong cedis symbols and unfinished sample copy.

Accessibility and browser-test tooling were used only in the build workspace. They are **not included or loaded by the delivered website**; no framework, package manager or build step is needed to use it.

### Still requires the owner

- [ ] Actual Android and iPhone app handoffs and deliberate test-message receipt.
- [ ] Final deployed-domain routing, nested 404 behaviour, HTTPS and browser favicon checks.
- [ ] Privacy/legal review and final business-policy/bio approval.
- [ ] A manual screen-reader and zoom review if possible.

These remaining checks have not been marked complete or represented as completed real-device testing.

## Readability update

- [x] Smaller navigation, footer, badges, form labels/helper text, and table text were increased slightly without changing the main heading sizes.
- [x] All 23 pages were rechecked for layout overflow at the seven preview widths after the font update.
- [x] WhatsApp and email brief messages were verified identical, with a blank line between the heading and every one of the 12 fields.
- [x] The refreshed self-contained preview was tested, including message spacing, navigation and mobile menu.

## Hero pricing notes and FAQ update

- [x] All 16 relevant service/pricing heroes show one concise pricing note directly below the headline.
- [x] Notes were verified visible before scrolling at 375×812 and 1440×1000; the lowest phone note ended above 475px.
- [x] Repeated general pricing notice boxes and the footer pricing caveat were removed. Scope exclusions, confidentiality safeguards, price-status badges and individual-quote requirements remain.
- [x] The FAQ now has 11 items. The authorship question was removed; unlisted-service requests receive a welcoming Yes; the grades answer emphasises striving for high-quality work and excellent results without guaranteeing outcomes.
- [x] Revised pricing/service pages passed desktop and mobile automated accessibility checks.
