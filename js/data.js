/* JAS DATA — single source of truth for pricing and services.
   To update prices, edit this file only. Every page reads from window.JAS_DATA.
   Contact info is also stored here for reuse. */
(function () {
  'use strict';
  window.JAS_DATA = {
    services: [
      { id: 'assignments-presentations', name: 'Assignments & Presentations', description: 'Word assignments and slide decks for BSc, MSc and MPhil students.', subServices: [
        { id: 'word-assignments', name: 'Word Assignments', description: 'Scope-based assignment guidance, review and formatting, with separate BSc and MSc/MPhil page bands.' },
        { id: 'powerpoint', name: 'PowerPoint Presentations', description: 'Presentation content guidance and slide design based on slide count and content readiness.' }
      ] },
      { id: 'research-support', name: 'Research Guidance', description: 'Diagnostic review, technical help with data and analysis, and end-to-end milestone guidance.', subServices: [
        { id: 'diagnostic-review', name: 'Diagnostic Research Review', description: 'A written audit of research logic with prioritised feedback and a correction plan.' },
        { id: 'technical-support', name: 'Specialist Technical Support', description: 'Task-based data, analysis and research coaching.' },
        { id: 'end-to-end', name: 'End-to-End Research Guidance', description: 'Milestone-based guidance and feedback from proposal planning through final review.' }
      ] },
      { id: 'bsn-case-studies', name: 'BSN & BSM Case Studies', description: 'Clinical case-study structure, nursing care plans, reasoning and presentation.', subServices: [
        { id: 'comprehensive', name: 'Comprehensive Case Study', description: 'Guidance on structure, clinical reasoning, care plans and references.' },
        { id: 'complex', name: 'Complex Case', description: 'Support for complex cases with extensive care plans, individually quoted after review.' }
      ] },
      { id: 'editing-formatting', name: 'Research & Case Study Edits', description: 'Grammar, clarity, tone and structure for research drafts and case studies — from light polish to substantial restructuring.', subServices: [
        { id: 'light', name: 'Light Editing', description: 'Grammar, spelling and clarity for structurally sound drafts.' },
        { id: 'moderate', name: 'Moderate Refinement', description: 'Flow, tone, repetition and consistency fixes.' },
        { id: 'substantial', name: 'Substantial Refinement', description: 'Restructuring, reorganisation and argument-flow improvements. Major research redesign excluded.' }
      ] }
    ],
    pricing: [
      { id: 'bsc-1', group: 'bsc', scope: '1–3', min: 40, max: 80, status: 'confirmed' },
      { id: 'bsc-2', group: 'bsc', scope: '4–7', min: 80, max: 150, status: 'confirmed' },
      { id: 'bsc-3', group: 'bsc', scope: '8–12', min: 150, max: 250, status: 'confirmed' },
      { id: 'bsc-4', group: 'bsc', scope: '13–20', min: 250, max: 400, status: 'confirmed' },
      { id: 'postgrad-1', group: 'postgrad', scope: '1–3', min: 100, max: 150, status: 'confirmed' },
      { id: 'postgrad-2', group: 'postgrad', scope: '4–7', min: 150, max: 250, status: 'confirmed' },
      { id: 'postgrad-3', group: 'postgrad', scope: '8–12', min: 250, max: 400, status: 'confirmed' },
      { id: 'postgrad-4', group: 'postgrad', scope: '13–20', min: 400, max: 700, status: 'confirmed' },
      { id: 'slides-1', group: 'powerpoint', scope: '1–15', min: 80, max: 150, status: 'confirmed' },
      { id: 'slides-2', group: 'powerpoint', scope: '16+', min: 150, max: null, from: true, status: 'confirmed' },
      { id: 'light', group: 'editing', scope: 'Light editing', min: 150, max: 250, status: 'provisional' },
      { id: 'moderate', group: 'editing', scope: 'Moderate refinement', min: 250, max: 400, status: 'provisional' },
      { id: 'substantial', group: 'editing', scope: 'Substantial refinement', min: 400, max: 600, status: 'provisional' },
      { id: 'diagnostic-1', group: 'diagnostic', scope: 'One chapter', min: 250, max: 400, status: 'provisional' },
      { id: 'diagnostic-2', group: 'diagnostic', scope: 'Two or three related chapters', min: 400, max: 600, status: 'provisional' },
      { id: 'diagnostic-3', group: 'diagnostic', scope: 'Full BSc proposal audit', min: 500, max: 800, status: 'provisional' },
      { id: 'diagnostic-4', group: 'diagnostic', scope: 'Extensive dissertation audit', min: 700, max: 1200, status: 'provisional' },
      { id: 'consultation', group: 'technical', scope: 'Topic feasibility consultation', min: 100, max: 200, status: 'provisional' },
      { id: 'questionnaire', group: 'technical', scope: 'Questionnaire review', min: 100, max: 250, status: 'provisional' },
      { id: 'instrument', group: 'technical', scope: 'Instrument development support', min: 200, max: 400, status: 'provisional' },
      { id: 'cleaning', group: 'technical', scope: 'Data entry and cleaning', min: 150, max: 350, status: 'provisional' },
      { id: 'descriptive', group: 'technical', scope: 'Descriptive statistics and tables', min: 250, max: 400, status: 'provisional' },
      { id: 'inferential', group: 'technical', scope: 'Inferential and complex statistical analysis', min: 400, max: 800, status: 'provisional' },
      { id: 'interpretation', group: 'technical', scope: 'Results interpretation session', min: 150, max: 300, status: 'provisional' },
      { id: 'discussion', group: 'technical', scope: 'Results and discussion coaching', min: 200, max: 450, status: 'provisional' },
      { id: 'defence', group: 'technical', scope: 'Research defence coaching', min: 150, max: 300, status: 'provisional' },
      { id: 'package-bsc', group: 'packages', scope: 'BSc Research Package', min: 1700, max: 2500, status: 'target' },
      { id: 'package-postgrad', group: 'packages', scope: 'MSc/MPhil Research Package', min: 2500, max: 3600, status: 'target' },
      { id: 'bsn-comprehensive', group: 'bsn', scope: 'Comprehensive case study', min: 700, max: 1000, status: 'target' },
      { id: 'bsn-complex', group: 'bsn', scope: 'Complex case with extensive care plans', min: 1000, max: 1400, status: 'provisional', quoteRequired: true }
    ],
    contact: { whatsapp: '233534423173', calls: ['0534423173', '0205243731'], email: 'jessenyarko192@gmail.com', hours: '24/7' },
    policy: {
      disclaimer: "Prices are indicative and depend on scope, complexity and deadline. Your final quote is agreed before work begins.",
      urgency: 'Normal deadlines have no surcharge. Urgent deadlines (under 48 hours) may attract a surcharge, confirmed in your quote and subject to individual discussion.',
      payment: 'Small jobs — full upfront. Larger jobs — 50% deposit, balance before final delivery. Research packages — milestone payments agreed in writing.'
    }
  };

  const data = window.JAS_DATA;
  const number = value => Number(value).toLocaleString('en-GH');
  const range = (row, currency) => (row.from ? 'From ' : '') + (currency ? 'GH₵' : '') + number(row.min) + (row.max !== null ? '–' + number(row.max) : '');
  document.querySelectorAll('[data-price-table]').forEach(body => {
    data.pricing.filter(row => row.group === body.dataset.priceTable).forEach(row => {
      const tr = document.createElement('tr');
      const scope = document.createElement('td');
      const price = document.createElement('td');
      scope.textContent = row.scope;
      price.textContent = range(row, false);
      tr.append(scope, price);
      body.append(tr);
    });
  });
  document.querySelectorAll('[data-price]').forEach(element => {
    const row = data.pricing.find(item => item.id === element.dataset.price);
    if (row) element.textContent = range(row, true);
  });
  document.querySelectorAll('[data-minimum]').forEach(element => {
    const rows = data.pricing.filter(item => item.group === element.dataset.minimum);
    if (rows.length) element.textContent = 'Minimum charge GH₵' + number(Math.min(...rows.map(item => item.min))) + '.';
  });
  document.querySelectorAll('[data-policy]').forEach(element => {
    element.textContent = data.policy[element.dataset.policy] || '';
  });
  document.querySelectorAll('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });
  document.querySelectorAll('[data-contact-link]').forEach(link => {
    const type = link.dataset.contactLink;
    if (type === 'whatsapp') {
      link.href = 'https://wa.me/' + data.contact.whatsapp + (link.dataset.message ? '?text=' + encodeURIComponent(link.dataset.message) : '');
    } else if (type === 'email') {
      link.href = 'mailto:' + data.contact.email;
    } else if (type === 'call') {
      link.href = 'tel:' + data.contact.calls[Number(link.dataset.callIndex || 0)];
    }
  });
  document.querySelectorAll('[data-contact-text]').forEach(element => {
    const type = element.dataset.contactText;
    if (type === 'email') element.textContent = data.contact.email;
    if (type === 'call') element.textContent = data.contact.calls[Number(element.dataset.callIndex || 0)];
    if (type === 'hours') element.textContent = data.contact.hours;
  });

  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    const closeMenu = focus => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      if (focus) toggle.focus();
    };
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
    });
    document.addEventListener('click', event => {
      if (!event.target.closest('.site-header')) closeMenu(false);
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu(false)));
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 960) closeMenu(false);
    });
  }

  const form = document.getElementById('quote-form');
  if (!form) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  const submitText = document.getElementById('submit-brief-text');
  submitBtn.disabled = false;
  const panel = document.getElementById('brief-ready');
  const panelMessage = document.getElementById('brief-ready-message');
  const errorPanel = document.getElementById('form-error');
  const errorFallbackLinks = document.getElementById('error-fallback-links');
  const fields = ['name', 'email', 'phone', 'level', 'service', 'description', 'deadline', 'draft', 'preferred', 'consent'];
  const messages = {
    name: 'Please enter your name.',
    email: 'Please enter a valid email address.',
    phone: 'Please enter a valid phone number.',
    level: 'Please select your level.',
    service: 'Please select a service.',
    description: 'Please describe what you need (at least 20 characters).',
    deadline: 'Please choose a deadline.',
    draft: 'Please tell us if you have a draft.',
    preferred: 'Please choose a contact method.',
    consent: 'Please tick the consent box to continue.'
  };
  const fieldValue = name => {
    const checked = form.querySelector('input[name="' + name + '"]:checked');
    if (name === 'draft' || name === 'preferred') return checked ? checked.value : '';
    const element = form.elements.namedItem(name);
    return element ? element.value.trim() : '';
  };
  const setError = (name, invalid) => {
    const error = document.getElementById(name + '-error');
    const container = form.querySelector('[data-field="' + name + '"]');
    error.textContent = invalid ? messages[name] : '';
    error.hidden = !invalid;
    container.classList.toggle('has-error', invalid);
    container.querySelectorAll('input, select, textarea').forEach(input => {
      if (invalid) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
  };
  const hideAlerts = () => {
    if (errorPanel) errorPanel.hidden = true;
  };
  const fileInput = document.getElementById('files');
  const fileList = document.getElementById('selected-files');
  const fileError = document.getElementById('files-error');
  const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'jpg', 'jpeg', 'png', 'zip']);
  let selectedFiles = []; // Memory only; never persist files or enquiries in browser storage.
  const validateFiles = () => {
    let message = '';
    if (selectedFiles.length > 3) message = 'Please remove files until at most 3 remain.';
    else if (selectedFiles.some(file => file.size > 5_000_000)) message = 'Each file must be 5MB or smaller. Use WhatsApp for larger files.';
    else if (selectedFiles.some(file => !file.name.includes('.') || !allowedExtensions.has(file.name.split('.').pop().toLowerCase()))) {
      message = 'Only PDF, DOC, DOCX, PPT, PPTX, JPG, JPEG, PNG or ZIP files are allowed.';
    } else if (selectedFiles.some(file => file.size === 0)) message = 'Empty files cannot be uploaded.';
    else if (selectedFiles.reduce((total, file) => total + file.size, 0) > 4_000_000) {
      message = 'Combined file size must not exceed 4MB. Remove files or use WhatsApp for larger files.';
    }
    fileError.textContent = message;
    fileError.hidden = !message;
    fileInput.closest('.field').classList.toggle('has-error', !!message);
    if (message) {
      fileInput.setAttribute('aria-invalid', 'true');
      errorFallbackLinks.hidden = false;
    } else fileInput.removeAttribute('aria-invalid');
    return !message;
  };
  const renderFiles = () => {
    fileList.replaceChildren();
    selectedFiles.forEach((file, index) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = file.name + ' — ' + (file.size / 1_000_000).toFixed(2) + ' MB';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-file';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + file.name);
      remove.addEventListener('click', () => {
        if (submitBtn.disabled) return;
        selectedFiles.splice(index, 1);
        renderFiles();
        validateFiles();
        fileInput.focus();
      });
      item.append(label, remove);
      fileList.append(item);
    });
  };
  fileInput.addEventListener('change', () => {
    selectedFiles.push(...Array.from(fileInput.files));
    // The array is the source of truth; clearing also allows reselecting a removed file.
    fileInput.value = '';
    renderFiles();
    validateFiles();
  });
  form.addEventListener('input', hideAlerts);
  form.addEventListener('change', hideAlerts);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitBtn.disabled) return;
    hideAlerts();
    if (!validateFiles()) { fileInput.focus(); return; }
    const phone = fieldValue('phone');
    const phoneDigits = phone.replace(/\D/g, '');
    const date = fieldValue('deadline');
    const email = form.elements.namedItem('email');
    const invalid = {
      name: !fieldValue('name'),
      email: !fieldValue('email') || !email.validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValue('email')),
      phone: !/^[+\d\s().-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15,
      level: !fieldValue('level'),
      service: !fieldValue('service'),
      description: fieldValue('description').length < 20,
      deadline: !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)),
      draft: !fieldValue('draft'),
      preferred: !fieldValue('preferred'),
      consent: !form.elements.namedItem('consent').checked
    };
    fields.forEach(name => setError(name, invalid[name]));
    const first = fields.find(name => invalid[name]);
    if (first) {
      form.querySelector('[data-field="' + first + '"] input, [data-field="' + first + '"] select, [data-field="' + first + '"] textarea').focus();
      return;
    }

    const payload = {
      name: fieldValue('name'),
      email: fieldValue('email'),
      phone,
      level: fieldValue('level'),
      service: fieldValue('service'),
      title: fieldValue('title'),
      description: fieldValue('description'),
      length: fieldValue('count'),
      deadline: date,
      existing_draft: fieldValue('draft'),
      preferred_contact: fieldValue('preferred'),
      notes: fieldValue('notes'),
      consent: form.elements.namedItem('consent').checked,
      website: fieldValue('website')
    };

    const message = [
      "Jey's Academic Studio — Quote Request",
      'Name: ' + payload.name,
      'Email: ' + payload.email,
      'Phone/WhatsApp: ' + payload.phone,
      'Level: ' + payload.level,
      'Service: ' + payload.service,
      'Title: ' + (payload.title || '—'),
      'Description: ' + payload.description,
      'Length: ' + (payload.length || '—'),
      'Deadline: ' + payload.deadline,
      'Existing draft: ' + payload.existing_draft,
      'Preferred contact: ' + payload.preferred_contact,
      'Additional notes: ' + (payload.notes || '—')
    ].join('\n\n');
    const subject = "Quote request — Jey's Academic Studio — " + payload.service;
    const whatsappHref = 'https://wa.me/' + data.contact.whatsapp + '?text=' + encodeURIComponent(message);
    const emailHref = 'mailto:' + data.contact.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(message);

    ['send-whatsapp', 'fallback-whatsapp'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = whatsappHref;
    });
    ['send-email', 'fallback-email'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = emailHref;
    });

    submitBtn.disabled = true;
    fileInput.disabled = true;
    fileList.querySelectorAll('button').forEach(button => { button.disabled = true; });
    const loadingText = selectedFiles.length ? 'Uploading files…' : 'Sending…';
    if (submitText) submitText.textContent = loadingText;
    else submitBtn.textContent = loadingText;

    try {
      const options = { method: 'POST' };
      if (selectedFiles.length) {
        const multipart = new FormData();
        Object.entries(payload).forEach(([key, value]) => multipart.append(key, String(value)));
        selectedFiles.forEach(file => multipart.append('files', file, file.name));
        options.body = multipart; // Browser sets Content-Type including the boundary.
      } else {
        options.headers = { 'Content-Type': 'application/json' };
        options.body = JSON.stringify(payload);
      }
      const response = await fetch('/api/submit', options);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) {
        throw new Error(result.errors?.files || result.error || 'Request failed');
      }

      const shortRef = String(result.id || '').slice(0, 8);
      if (panelMessage) {
        panelMessage.textContent =
          'Brief received. Thanks ' +
          payload.name +
          ". You'll hear back at " +
          payload.preferred_contact +
          ' typically within a few hours. Reference: ' +
          shortRef +
          '.';
        if (Array.isArray(result.warnings) && result.warnings.length) {
          panelMessage.textContent += ' ' + result.warnings.join(' ');
        }
      }
      selectedFiles = [];
      form.hidden = true;
      if (errorPanel) errorPanel.hidden = true;
      panel.hidden = false;
      panel.focus();
      panel.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    } catch (error) {
      submitBtn.disabled = false;
      fileInput.disabled = false;
      fileList.querySelectorAll('button').forEach(button => { button.disabled = false; });
      document.getElementById('form-error-text').textContent =
        (error.message === 'Failed to fetch' ? 'Connection failed. Please try again.' : error.message) + ' You can also use WhatsApp or email below.';
      if (submitText) submitText.textContent = 'Send brief';
      else submitBtn.textContent = 'Send brief';
      if (errorFallbackLinks) errorFallbackLinks.hidden = false;
      if (errorPanel) {
        errorPanel.hidden = false;
        errorPanel.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
    }
  });
})();
