import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+\d\s().-]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MAX_LENGTHS = {
  name: 100,
  email: 200,
  phone: 30,
  level: 50,
  service: 100,
  title: 200,
  description: 5000,
  length: 50,
  notes: 1000
};

/**
 * Trim string and strip dangerous control characters.
 * Preserves newlines/tabs for multiline fields when allowMultiline is true.
 */
function cleanString(value, allowMultiline = false) {
  if (typeof value !== 'string') return '';
  const stripped = allowMultiline
    ? value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : value.replace(/[\x00-\x1F\x7F]/g, ' ');
  return stripped.trim();
}

/**
 * Escape HTML special characters before interpolating into the Resend email template.
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Extract the client IP address from Vercel / proxy headers and return its SHA-256 hash.
 */
function getHashedIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  let rawIp = '';
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    rawIp = forwarded.split(',')[0].trim();
  } else if (typeof req.headers['x-real-ip'] === 'string') {
    rawIp = req.headers['x-real-ip'].trim();
  } else if (req.socket?.remoteAddress) {
    rawIp = req.socket.remoteAddress;
  } else {
    rawIp = 'unknown';
  }
  return crypto.createHash('sha256').update(rawIp).digest('hex');
}

export default async function handler(req, res) {
  // 1. Enforce POST method only
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 2. Parse JSON body safely
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON request body.' });
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Invalid request payload.' });
  }

  // 3. Reject submissions with a non-empty honeypot field ("website")
  const honeypot = cleanString(body.website ?? '');
  if (honeypot.length > 0) {
    return res.status(400).json({
      error: 'Validation failed.',
      errors: { website: 'Spam submission rejected.' }
    });
  }

  // 4. Sanitise inputs
  const name = cleanString(body.name);
  const email = cleanString(body.email);
  const phone = cleanString(body.phone);
  const level = cleanString(body.level);
  const service = cleanString(body.service);
  const title = cleanString(body.title);
  const description = cleanString(body.description, true);
  const length = cleanString(body.length ?? body.count);
  const deadline = cleanString(body.deadline);
  const existing_draft = cleanString(body.existing_draft ?? body.draft);
  const preferred_contact = cleanString(body.preferred_contact ?? body.preferred);
  const notes = cleanString(body.notes, true);
  const consent =
    body.consent === true || body.consent === 'true' || body.consent === 'on';

  // 5. Validate required fields and max lengths
  const errors = {};

  if (!name) {
    errors.name = 'Name is required.';
  } else if (name.length > MAX_LENGTHS.name) {
    errors.name = `Name must be ${MAX_LENGTHS.name} characters or fewer.`;
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (email.length > MAX_LENGTHS.email) {
    errors.email = `Email must be ${MAX_LENGTHS.email} characters or fewer.`;
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = 'Please provide a valid email address.';
  }

  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone) {
    errors.phone = 'WhatsApp or phone number is required.';
  } else if (phone.length > MAX_LENGTHS.phone) {
    errors.phone = `Phone number must be ${MAX_LENGTHS.phone} characters or fewer.`;
  } else if (!PHONE_REGEX.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Please provide a valid phone number.';
  }

  if (!level) {
    errors.level = 'Academic level is required.';
  } else if (level.length > MAX_LENGTHS.level) {
    errors.level = `Academic level must be ${MAX_LENGTHS.level} characters or fewer.`;
  }

  if (!service) {
    errors.service = 'Service category is required.';
  } else if (service.length > MAX_LENGTHS.service) {
    errors.service = `Service category must be ${MAX_LENGTHS.service} characters or fewer.`;
  }

  if (title.length > MAX_LENGTHS.title) {
    errors.title = `Title must be ${MAX_LENGTHS.title} characters or fewer.`;
  }

  if (!description) {
    errors.description = 'Description is required.';
  } else if (description.length < 20) {
    errors.description = 'Description must be at least 20 characters.';
  } else if (description.length > MAX_LENGTHS.description) {
    errors.description = `Description must be ${MAX_LENGTHS.description} characters or fewer.`;
  }

  if (length.length > MAX_LENGTHS.length) {
    errors.length = `Page or slide count must be ${MAX_LENGTHS.length} characters or fewer.`;
  }

  if (!deadline || !DATE_REGEX.test(deadline) || Number.isNaN(Date.parse(deadline))) {
    errors.deadline = 'Please provide a valid deadline date (YYYY-MM-DD).';
  }

  if (!existing_draft || !['Yes', 'No'].includes(existing_draft)) {
    errors.existing_draft = 'Please specify whether you have an existing draft (Yes or No).';
  }

  if (!preferred_contact || !['WhatsApp', 'Email', 'Call'].includes(preferred_contact)) {
    errors.preferred_contact = 'Please choose a valid preferred contact method.';
  }

  if (notes.length > MAX_LENGTHS.notes) {
    errors.notes = `Notes must be ${MAX_LENGTHS.notes} characters or fewer.`;
  }

  if (!consent) {
    errors.consent = 'You must consent to being contacted about this enquiry.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      error: 'Validation failed.',
      errors
    });
  }

  // 6. Initialise Supabase using the server-side secret / service role key
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY environment variable.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  // 7. Enforce rate limit via existing Supabase RPC function
  const ipHash = getHashedIp(req);
  const { data: rateData, error: rateError } = await supabase.rpc(
    'consume_enquiry_rate_limit',
    { p_ip_hash: ipHash }
  );

  if (rateError) {
    console.error('Rate limit check failed:', rateError.message);
    return res.status(500).json({ error: 'Could not verify rate limit.' });
  }

  const rateRow = Array.isArray(rateData) ? rateData[0] : rateData;
  if (rateRow && rateRow.allowed === false) {
    const retryAfter = Number(rateRow.retry_after) || 60;
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many enquiries submitted recently. Please wait and try again.',
      retry_after: retryAfter
    });
  }

  // 8. Insert enquiry into Supabase `enquiries` table
  const userAgent =
    typeof req.headers['user-agent'] === 'string'
      ? req.headers['user-agent'].trim().slice(0, 500)
      : null;

  const enquiryId = crypto.randomUUID();
  const { data: inserted, error: insertError } = await supabase
    .from('enquiries')
    .insert([
      {
        id: enquiryId,
        created_at: new Date().toISOString(),
        name,
        email,
        phone,
        level,
        service,
        title: title || null,
        description,
        length: length || null,
        deadline,
        existing_draft,
        preferred_contact,
        notes: notes || null,
        status: 'new',
        user_agent: userAgent,
        ip_hash: ipHash
      }
    ])
    .select('id')
    .single();

  if (insertError || !inserted) {
    console.error('Supabase insert error:', insertError?.message || 'No row returned');
    return res.status(500).json({ error: 'Failed to save enquiry.' });
  }

  const savedId = inserted.id || enquiryId;
  const shortRef = String(savedId).slice(0, 8);

  // 9. Send notification email via Resend (non-blocking failure if DB insert succeeded)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.warn('RESEND_API_KEY is not set; skipping email notification for enquiry', savedId);
  } else {
    try {
      const resend = new Resend(resendApiKey);
      const emailHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f1e3d; max-width: 640px; margin: 0 auto; line-height: 1.6;">
          <h2 style="margin: 0 0 8px; color: #0f1e3d;">New Enquiry — Jey's Academic Studio</h2>
          <p style="margin: 0 0 20px; color: #475569; font-size: 14px;">
            Reference: <strong>${escapeHtml(shortRef)}</strong> (${escapeHtml(savedId)})
          </p>

          <pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; background: #f6f4ee; border: 1px solid #e5e1d6; border-left: 4px solid #b8901f; border-radius: 8px; padding: 14px 16px; margin: 0 0 22px; font-size: 13px; line-height: 1.6; color: #0f1e3d; white-space: pre-wrap;">Deadline:         ${escapeHtml(deadline)}
Academic Level:   ${escapeHtml(level)}
Page/Slide Count: ${escapeHtml(length || '—')}</pre>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px; font-size: 15px;">
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600; width: 170px;">Name</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;">${escapeHtml(name)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600;">Email</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;"><a href="mailto:${escapeHtml(email)}" style="color: #0f1e3d;">${escapeHtml(email)}</a></td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600;">Phone / WhatsApp</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;">${escapeHtml(phone)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600;">Preferred Contact</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;">${escapeHtml(preferred_contact)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600;">Service Category</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;">${escapeHtml(service)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600;">Project Title</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;">${escapeHtml(title || '—')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6; font-weight: 600;">Existing Draft</td>
              <td style="padding: 8px 12px; border-bottom: 1px solid #e5e1d6;">${escapeHtml(existing_draft)}</td>
            </tr>
          </table>

          <h3 style="margin: 0 0 8px; font-size: 16px; color: #0f1e3d;">Short Description</h3>
          <div style="background: #fdfcf9; border: 1px solid #e5e1d6; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; white-space: pre-wrap;">${escapeHtml(description)}</div>

          <h3 style="margin: 0 0 8px; font-size: 16px; color: #0f1e3d;">Additional Notes</h3>
          <div style="background: #fdfcf9; border: 1px solid #e5e1d6; border-radius: 8px; padding: 14px 16px; margin-bottom: 18px; white-space: pre-wrap;">${escapeHtml(notes || '—')}</div>
        </div>
      `;

      const { error: emailError } = await resend.emails.send({
        from: 'JAS Enquiries <onboarding@resend.dev>',
        to: 'jessenyarko192@gmail.com',
        replyTo: email,
        reply_to: email,
        subject: `New enquiry — ${service} — ${name}`,
        html: emailHtml
      });

      if (emailError) {
        console.warn('Resend email warning (enquiry still saved):', emailError);
      }
    } catch (err) {
      console.warn('Resend exception (enquiry still saved):', err?.message || err);
    }
  }

  return res.status(200).json({
    success: true,
    id: savedId
  });
}
