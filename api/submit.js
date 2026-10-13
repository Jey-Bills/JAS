import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Read the raw multipart stream ourselves; JSON submissions remain supported.
export const config = { api: { bodyParser: false } };

const MAX_FILES = 3;
const MAX_FILE_BYTES = 5_000_000;
const MAX_TOTAL_BYTES = 4_000_000; // Owner-approved combined cap, below Vercel's 4.5 MB limit.
const MAX_REQUEST_BYTES = MAX_TOTAL_BYTES + 64_000; // Bounded fields + multipart overhead.
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;
const FILE_TYPES = {
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  zip: ['application/zip', 'application/x-zip-compressed']
};

function fileError(message) {
  const error = new Error(message);
  error.isValidationError = true;
  return error;
}

function sanitizeFilename(name) {
  // Restrict to a safe, readable basename; remove separators, quotes and controls.
  const safe = name.replace(/[\\/"'\x00-\x1F\x7F]/g, '')
    .replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').trim();
  // Keep the extension when limiting the filename length.
  const dot = safe.lastIndexOf('.');
  if (dot < 1) return 'attachment.' + name.split('.').pop().toLowerCase();
  return safe.slice(0, dot).slice(0, 140) + safe.slice(dot).toLowerCase();
}

async function readPayload(req) {
  const contentType = req.headers['content-type'] || '';
  const multipart = /^multipart\/form-data(?:;|$)/i.test(contentType);
  if (!multipart && contentType && !/^application\/json(?:;|$)/i.test(contentType)) {
    throw fileError('Use application/json or multipart/form-data.');
  }
  if (Number(req.headers['content-length']) > MAX_REQUEST_BYTES) {
    throw fileError('Request too large. Files must total no more than 4MB. Use WhatsApp for larger files.');
  }

  // req.body supports existing parsed JSON integrations. Production reads the raw stream.
  let raw = req.body;
  if (raw === undefined) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytes += buffer.length;
      if (bytes > MAX_REQUEST_BYTES) throw fileError('Request too large. Use WhatsApp for larger files.');
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(raw) || typeof raw === 'string') {
    if (Buffer.byteLength(raw) > MAX_REQUEST_BYTES) throw fileError('Request too large. Use WhatsApp for larger files.');
  }
  if (!multipart) {
    try {
      const body = Buffer.isBuffer(raw) || typeof raw === 'string' ? JSON.parse(raw.toString()) : raw;
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
      return { body, files: [] };
    } catch {
      throw fileError('Invalid JSON request body.');
    }
  }

  if (!Buffer.isBuffer(raw)) throw fileError('Invalid multipart request body.');
  let form;
  try {
    // Node's Web Request parser handles boundaries and binary content without a dependency.
    form = await new Request('https://multipart.invalid', {
      method: 'POST', headers: { 'content-type': contentType }, body: raw
    }).formData();
  } catch {
    throw fileError('Invalid multipart request body.');
  }
  const body = Object.create(null);
  const files = [];
  for (const [key, value] of form.entries()) {
    if (typeof value !== 'string') {
      if (key !== 'files') throw fileError('Attachments must use the files field.');
      if (!value.name && !value.size) continue; // Empty native file input.
      files.push(value);
    } else {
      if (key.length > 100 || value.length > 6000) throw fileError('Form field is too long.');
      if (Object.hasOwn(body, key)) throw fileError('Duplicate form field.');
      body[key] = value;
    }
  }
  if (files.length > MAX_FILES) throw fileError('Attach no more than 3 files.');
  for (const file of files) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!file.name.includes('.') || !Object.hasOwn(FILE_TYPES, extension) || !FILE_TYPES[extension].includes(file.type)) {
      throw fileError('File extension and MIME type must match: PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG or ZIP.');
    }
    if (file.size > MAX_FILE_BYTES) throw fileError('Each file must be 5MB or smaller. Use WhatsApp for larger files.');
    if (file.size === 0) throw fileError('Empty files cannot be uploaded.');
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
    throw fileError('Combined file size must not exceed 4MB. Use WhatsApp for larger files.');
  }
  return { body, files };
}

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

  let body, files;
  try {
    ({ body, files } = await readPayload(req));
  } catch (error) {
    const message = error.isValidationError ? error.message : 'Could not read request body.';
    return res.status(400).json({ error: message, errors: { files: message } });
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

  // Bound external calls so Storage/Resend failures can return a saved-enquiry response
  // before Vercel's 30-second deadline. Parallel uploads share the same time budget.
  const backendBudget = AbortSignal.timeout(22_000);
  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    global: {
      fetch: (url, options = {}) => fetch(url, {
        ...options,
        signal: AbortSignal.any([backendBudget, AbortSignal.timeout(4_000), ...(options.signal ? [options.signal] : [])])
      })
    },
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
        ip_hash: ipHash,
        file_paths: null
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

  // Save the brief FIRST so an unavailable Storage service cannot lose the enquiry.
  const warnings = [];
  let uploadedFiles = [];
  const bucket = supabase.storage.from('enquiry-files');
  const uploadResults = await Promise.all(files.map(async file => {
    const name = sanitizeFilename(file.name);
    const path = `enquiries/${savedId}/${crypto.randomUUID()}-${name}`;
    try {
      const { error } = await bucket.upload(path, Buffer.from(await file.arrayBuffer()), {
        contentType: file.type, upsert: false
      });
      if (error) throw error;
      return { path, name, size: file.size, type: file.type };
    } catch {
      // Only log the stage/reference, never a URL/token or user-supplied filename.
      console.warn('Attachment upload failed for enquiry', savedId);
      return null;
    }
  }));
  uploadedFiles = uploadResults.filter(Boolean);
  if (uploadedFiles.length !== files.length) {
    warnings.push('Some attachments could not be uploaded. Your enquiry was saved. Please send missing files via WhatsApp or email.');
  }
  if (uploadedFiles.length) {
    try {
      const { data: updated, error } = await supabase.from('enquiries')
        .update({ file_paths: uploadedFiles }).eq('id', savedId).select('id').single();
      if (error || !updated) throw error || new Error('No row updated');
    } catch {
      console.warn('Attachment metadata save failed for enquiry', savedId);
      // Best-effort removal prevents files without a database reference accumulating.
      try {
        const { error } = await bucket.remove(uploadedFiles.map(file => file.path));
        if (error) console.warn('Attachment cleanup needed for enquiry', savedId);
      } catch {
        console.warn('Attachment cleanup needed for enquiry', savedId);
      }
      uploadedFiles = [];
      warnings.push('Attachments could not be linked to your enquiry. Your enquiry was saved. Please send files via WhatsApp or email.');
    }
  }
  const downloadLinks = await Promise.all(uploadedFiles.map(async file => {
    try {
      const { data, error } = await bucket.createSignedUrl(file.path, SIGNED_URL_SECONDS);
      if (error || !data?.signedUrl) throw error || new Error('No link returned');
      return `<li><a href="${escapeHtml(data.signedUrl)}">${escapeHtml(file.name)}</a> (${escapeHtml((file.size / 1000).toFixed(1))} KB)</li>`;
    } catch {
      console.warn('Attachment signing failed for enquiry', savedId);
      return `<li>${escapeHtml(file.name)} — saved privately; download link unavailable. View in Supabase Storage.</li>`;
    }
  }));
  const attachmentsHtml = downloadLinks.length
    ? `<h3>Attachments</h3><ul>${downloadLinks.join('')}</ul><p>Download links expire in 7 days. Do not forward these private links.</p>`
    : '';
  const attachmentWarningsHtml = warnings.length
    ? `<p><strong>Attachment warning:</strong> ${warnings.map(escapeHtml).join(' ')}</p>` : '';

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

          ${attachmentsHtml}${attachmentWarningsHtml}
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
      }, { signal: AbortSignal.timeout(4_000) });

      if (emailError) {
        console.warn('Resend email failed; enquiry still saved', savedId);
      }
    } catch {
      console.warn('Resend exception; enquiry still saved', savedId);
    }
  }

  return res.status(200).json({
    success: true,
    id: savedId,
    warnings
  });
}
