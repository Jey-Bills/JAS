# Handover — Jey's Academic Studio Website

Prepared for Jesse Nyarko. Build date: **13 October 2026**.

## What was built

### Main website

- **Homepage:** the studio introduction, availability, four service categories and enquiry options.
- **Services:** an overview of the categories and help choosing a starting point.
- **Pricing:** all supplied price bands together, with status labels, urgency and payment notes.
- **How It Works:** six steps from choosing support to an agreed revision round, with authorship boundaries.
- **About:** studio introduction, working principles and the audiences served; no invented credentials.
- **FAQ:** 11 questions with keyboard-accessible expanding answers.
- **Contact:** WhatsApp, two telephone numbers, email, and a validated brief-preparation form.
- **Privacy:** draft notice covering enquiries, external resources and communications providers.
- **Page not found:** a 404 page with homepage and service links.

### Assignments & Presentations

- Category overview.
- Word Assignments: separate BSc and MSc/MPhil page-band tables.
- PowerPoint Presentations: slide-count bands and scope factors.

### Research Support

- Category overview.
- Diagnostic Research Review: what is assessed, what feedback is provided and what is excluded.
- Specialist Technical Support: nine task-based services.
- End-to-End Research Guidance: four milestones and two package ranges.

### BSN Case Studies

- Category overview.
- Comprehensive Case Study.
- Complex Case, individually quoted after review.

### Editing & Formatting

- Category overview.
- Light Editing.
- Moderate Refinement.
- Substantial Refinement, with major research redesign excluded.

### Supporting work

- One shared stylesheet and one shared JavaScript/data file.
- Consistent headers, footers and floating WhatsApp links on all 23 HTML pages.
- Mobile menu, semantic structure, visible focus indicators and reduced-motion support.
- Exact supplied per-page metadata, canonical links and social-sharing tags.
- SVG JAS favicon.
- Sitemap of 22 main pages and robots.txt. The 404 page is not included in the sitemap and is marked noindex.
- README.md, HANDOVER.md and TESTING.md.

## What is confirmed vs provisional

- **Confirmed ranges:** BSc Word assignments, MSc/MPhil Word assignments, PowerPoint slide pricing.
- **Provisional:** editing, diagnostic review and technical support.
- **Target ranges:** BSc and MSc/MPhil research packages, BSN comprehensive case study.
- **Individually quoted:** BSN complex case retains its **provisional GH₵1,000–1,400** range and also shows a **Quote individually** badge. A firm quote requires case review.

“Confirmed ranges” does not mean a fixed final fee or guaranteed availability at the lowest end. Every page displaying prices has one concise pricing note in its hero, before the price sections.

Displayed price tables and cards read from js/data.js. The minimum postgraduate charge is calculated from its bands. Badges and SEO descriptions should also be reviewed if a price status or range changes; see README.md.

## Brand and contact info used

- **Confirmed brand:** Jey's Academic Studio.
- **Tagline:** Expert Assistance. Clear Guidance. Better Academic Work.
- **WhatsApp:** 0534423173; international link number: 233534423173.
- **Calls:** 0534423173 and 0205243731.
- **Email:** jessenyarko192@gmail.com.
- **Hours shown:** 24/7.
- **Reply wording supplied:** replies typically within a few hours.

The studio bio uses the supplied Jesse Nyarko wording, without adding qualifications or experience. The brand is confirmed; the bio remains subject to final wording approval.

## What's pending before launch

- [ ] Confirm the real domain. The current unconfirmed domain is **jaysacademic.studio**; replace it throughout metadata, sitemap.xml and robots.txt. The brand stays Jey's Academic Studio.
- [ ] Approve the Jesse Nyarko bio and remove its pre-launch wording note after approval.
- [ ] Confirm you can meet the displayed 24/7 availability and typical reply-time wording.
- [ ] Approve price bands, payment terms, urgency surcharge wording and revision limits.
- [ ] Have privacy.html reviewed against the **Ghana Data Protection Act, 2012 (Act 843)** and actual studio practices, including retention, deletion, confidentiality and provider arrangements.
- [ ] Confirm the supplied Unsplash library image is suitable and its use meets the applicable licence/terms. Keep a record if replacing it with your own licensed image.
- [ ] Test on a real Android phone and iPhone, including WhatsApp, email and telephone handoffs.
- [ ] Test the hosted 404 response on both top-level and nested nonexistent URLs.
- [ ] Optional: replace the JAS text logo with a transparent-background image logo.
- [ ] Optional: add a real social link if one exists. None has been invented or shown.
- [ ] Optional: replace the remote photo with a local image for a more reliable background. Google Fonts remains an external dependency unless also removed or replaced with the existing system-font fallback.
- [ ] Optional: add a PNG Apple touch icon for broader iOS support; the requested SVG favicon is included.
- [ ] Keep HANDOVER.md and TESTING.md out of the published folder if you do not want these notes public.

## Things to check monthly

- Price bands and policies still match what you charge.
- WhatsApp, telephone and email links still work.
- No broken page links.
- The homepage image still loads.
- Availability and reply wording still reflect actual service.
- Contact details and privacy practices remain accurate.

## What we deliberately did not build

### No admin panel

The MVP communicates through WhatsApp, email and telephone. Avoiding an admin panel keeps operations simple and avoids adding authentication and enquiry-storage risks before they are needed.

### No online payments

Payment arrangements are part of the scoped quote. No gateway, card collection or automated payment confirmation is included, keeping payment security and provider integrations outside the MVP.

### No accounts

Visitors can enquire without registering. This avoids password management and unnecessary personal-data collection.

### No file uploads

The form cannot receive attachments. Documents can be shared separately after the initial quote is confirmed. A secure upload system needs access controls, retention policies and careful handling of sensitive documents.

### No analytics or tracking

There are no tracking scripts. This preserves the simple, privacy-conscious scope. External fonts, the photo, the hosting provider and communication apps may still process technical information; the privacy draft explains this distinction.

## If you need an upgrade later

These are future options, **not included in v1**:

1. A simple form backend, such as Netlify Forms or Formspree, so briefs arrive automatically. Review security, consent and privacy before changing the current no-backend approach.
2. An enquiry/job tracking panel with controlled access and an appropriate retention policy.
3. Secure document upload, only with adequate authentication, access restrictions and patient-data safeguards.
4. Automated invoices and receipts, followed by payments only if operationally useful.
5. Privacy-conscious analytics, only after updating the privacy notice and assessing consent requirements.

## Decisions made while integrating the seven specifications

- All four supplied “How to choose” options are shown, despite one prompt saying three.
- There are 23 HTML files including 404.html, and 22 main-page sitemap entries.
- Prices are rendered from the data file rather than maintained in duplicate HTML tables.
- Complex BSN pricing is provisional and individually quoted, not relabelled as a confirmed fee.
- Supplied exact SEO descriptions were retained. Some are outside the general 140–160-character recommendation; unique, accurate wording takes precedence over padding them.
- Explicitly specified badge, availability, WhatsApp and validation colours are functional exceptions to the brand palette; no new brand colours or fonts were added.
- There is no header WhatsApp link in the supplied header layout. The header quote button goes to Contact; WhatsApp is available through the CTA, footer, contact cards and floating button.
- Intentional domain and privacy draft notices remain as honest launch-review items, rather than being concealed.

## Verification

See TESTING.md for the automated build-verification record and remaining owner checks. A desktop browser simulation is not a substitute for real-device app testing or a Ghanaian data-protection review. This handover does not claim the site is already published on the unconfirmed domain.

## Latest content preferences

General pricing disclaimers have been consolidated into one concise note in each relevant hero, before the lead and price sections. The body and footer no longer repeat that general disclaimer. Service-specific exclusions, clinical safeguards and individually quoted scope remain explicit. The FAQ contains 11 questions and uses the owner's revised, welcoming wording for unlisted services and aspirational wording for quality/results, without promising guaranteed grades.
