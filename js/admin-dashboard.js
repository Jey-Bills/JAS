import { requireAuth } from './admin-auth.js';
import { getSupabaseClient } from './supabase-client.js';

export const ENQUIRY_PAGE_SIZE = 50;
export const STATUS_VALUES = Object.freeze([
  'new',
  'quoted',
  'in_progress',
  'delivered',
  'paid',
  'archived'
]);

export const STATUS_LABELS = Object.freeze({
  new: 'New',
  quoted: 'Quoted',
  in_progress: 'In Progress',
  delivered: 'Delivered',
  paid: 'Paid',
  archived: 'Archived'
});

export const CSV_HEADERS = Object.freeze([
  'Reference',
  'Created At',
  'Name',
  'Email',
  'Phone',
  'Level',
  'Service',
  'Title',
  'Description',
  'Length',
  'Deadline',
  'Existing Draft',
  'Preferred Contact',
  'Notes',
  'Status',
  'File Count'
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_DOWNLOAD_ENDPOINT = '/api/admin/signed-url';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
});

function asDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function createdTime(enquiry) {
  const date = asDate(enquiry?.created_at);
  return date ? date.getTime() : null;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function enquiryId(enquiry) {
  return String(enquiry?.id ?? '');
}

function cleanStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function friendlyError(error, fallback) {
  const message = String(error?.message || '').trim();
  if (!message) return fallback;
  return message.length > 220 ? `${message.slice(0, 217)}…` : message;
}

/** Calculate dashboard counts from the complete enquiry list. */
export function getEnquiryStats(enquiries, now = new Date()) {
  const rows = Array.isArray(enquiries) ? enquiries : [];
  const currentTime = asDate(now)?.getTime() ?? Date.now();
  const currentDate = new Date(currentTime);
  const weekStart = currentTime - 7 * DAY_MS;
  const monthStart = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getTime();

  let newCount = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  for (const row of rows) {
    if (String(row?.status || '').toLowerCase() === 'new') newCount += 1;
    const time = createdTime(row);
    if (time === null) continue;
    if (time >= weekStart && time <= currentTime) thisWeek += 1;
    if (time >= monthStart && time <= currentTime) thisMonth += 1;
  }

  return { total: rows.length, new: newCount, thisWeek, thisMonth };
}

/** Apply every selected filter, including the free-text enquiry search. */
export function filterEnquiries(enquiries, filters = {}, now = new Date()) {
  const rows = Array.isArray(enquiries) ? enquiries : [];
  const currentTime = asDate(now)?.getTime() ?? Date.now();
  const query = String(filters.search || '').trim().toLocaleLowerCase();
  const status = String(filters.status || '').toLowerCase();
  const level = String(filters.level || '').toLocaleLowerCase();
  const service = String(filters.service || '').toLocaleLowerCase();
  const range = String(filters.dateRange || 'all');

  return rows.filter(row => {
    if (status && String(row?.status || '').toLowerCase() !== status) return false;
    if (level && String(row?.level || '').trim().toLocaleLowerCase() !== level) return false;
    if (service && String(row?.service || '').trim().toLocaleLowerCase() !== service) return false;

    const time = createdTime(row);
    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 7 : 30;
      if (time === null || time < currentTime - days * DAY_MS || time > currentTime) return false;
    } else if (range === 'custom') {
      if (time === null) return false;
      const dateKey = localDateKey(new Date(time));
      const from = String(filters.dateFrom || '');
      const to = String(filters.dateTo || '');
      if (from && dateKey < from) return false;
      if (to && dateKey > to) return false;
    }

    if (query) {
      const searchable = [row?.name, row?.email, row?.phone, row?.description]
        .map(value => String(value || ''))
        .join(' ')
        .toLocaleLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });
}

/** Sort a filtered enquiry list without mutating the cached result. */
export function sortEnquiries(enquiries, sort = { field: 'created_at', direction: 'desc' }) {
  const rows = Array.isArray(enquiries) ? [...enquiries] : [];
  const field = ['created_at', 'name', 'level', 'status'].includes(sort?.field)
    ? sort.field
    : 'created_at';
  const direction = sort?.direction === 'asc' ? 1 : -1;

  return rows.sort((left, right) => {
    let comparison = 0;
    if (field === 'created_at') {
      comparison = (createdTime(left) ?? 0) - (createdTime(right) ?? 0);
    } else {
      comparison = String(left?.[field] || '').localeCompare(
        String(right?.[field] || ''),
        undefined,
        { sensitivity: 'base', numeric: true }
      );
    }
    return comparison * direction;
  });
}

export function formatEnquiryDate(value) {
  const date = asDate(value);
  return date ? DATE_FORMATTER.format(date) : '—';
}

export function formatFileSize(value) {
  if (value === null || value === undefined || value === '') return 'Size unavailable';
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return 'Size unavailable';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status) {
  const clean = cleanStatus(status);
  if (!clean) return 'Unknown';
  if (STATUS_LABELS[clean]) return STATUS_LABELS[clean];
  return clean.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function getStatusLabel(status) {
  return statusLabel(status);
}

function setStatusBadge(element, status) {
  if (!element) return;
  const clean = cleanStatus(status);
  const className = STATUS_VALUES.includes(clean) ? clean : 'unknown';
  element.className = `admin-status-badge admin-status-${className}`;
  element.textContent = statusLabel(status);
}

function displayValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  return String(value);
}

function createStatusBadge(status) {
  const badge = document.createElement('span');
  setStatusBadge(badge, status);
  return badge;
}

function getAttachments(enquiry) {
  if (Array.isArray(enquiry?.file_paths)) return enquiry.file_paths;
  if (typeof enquiry?.file_paths === 'string') {
    try {
      const parsed = JSON.parse(enquiry.file_paths);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Phase 12: CSV export (pure helpers first so they are testable)      */
/* ------------------------------------------------------------------ */

/** Escape one CSV field for commas, quotes and newlines (RFC 4180). */
export function escapeCsvField(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Filename for today's export, e.g. jas-enquiries-2026-10-13.csv (local date). */
export function getCsvFilename(now = new Date()) {
  const date = asDate(now) || new Date();
  return `jas-enquiries-${localDateKey(date)}.csv`;
}

/**
 * Build the full CSV document (UTF-8 BOM + header + rows) for the given
 * enquiries, in the order supplied. Callers pass the currently filtered
 * list only — this helper never widens the selection.
 */
export function buildCsvContent(enquiries) {
  const rows = Array.isArray(enquiries) ? enquiries : [];
  const lines = [CSV_HEADERS.map(escapeCsvField).join(',')];
  for (const enquiry of rows) {
    const created = asDate(enquiry?.created_at);
    const fields = [
      String(enquiry?.id || '').slice(0, 8),
      created ? created.toISOString() : '',
      enquiry?.name,
      enquiry?.email,
      enquiry?.phone,
      enquiry?.level,
      enquiry?.service,
      enquiry?.title,
      enquiry?.description,
      enquiry?.length,
      enquiry?.deadline,
      enquiry?.existing_draft,
      enquiry?.preferred_contact,
      enquiry?.notes,
      statusLabel(enquiry?.status),
      getAttachments(enquiry).filter(file => file && typeof file === 'object').length
    ];
    lines.push(fields.map(escapeCsvField).join(','));
  }
  // BOM so Excel/Google Sheets detect UTF-8; CRLF line endings for Excel.
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/**
 * Build the CSV for `filteredEnquiries` and, in the browser, download it.
 * Returns { filename, content, count } (handy for tests / callers).
 */
export function exportToCSV(filteredEnquiries, now = new Date()) {
  const rows = Array.isArray(filteredEnquiries) ? filteredEnquiries : [];
  const content = buildCsvContent(rows);
  const filename = getCsvFilename(now);

  if (
    typeof document !== 'undefined' &&
    document.body &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  ) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    // Revoke after the click has had a tick to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return { filename, content, count: rows.length };
}

/* ------------------------------------------------------------------ */
/* Phase 12: Toast notifications                                       */
/* ------------------------------------------------------------------ */

/**
 * Show a toast notification. type: 'success' | 'error' | 'info'.
 * Safe to call outside the browser (no-ops and returns null).
 */
export function showToast(message, type = 'info', durationMs) {
  if (typeof document === 'undefined' || !document.body) return null;
  const cleanType = ['success', 'error', 'info'].includes(type) ? type : 'info';

  let container = document.getElementById('admin-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'admin-toast-container';
    container.className = 'admin-toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'false');
    document.body.append(container);
  }

  const toast = document.createElement('div');
  toast.className = `admin-toast admin-toast--${cleanType}`;
  toast.setAttribute('role', cleanType === 'error' ? 'alert' : 'status');

  const text = document.createElement('span');
  text.className = 'admin-toast-message';
  text.textContent = String(message || '');

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'admin-toast-close';
  dismiss.setAttribute('aria-label', 'Dismiss notification');
  dismiss.textContent = '×';

  let hideTimer = null;
  let removeTimer = null;
  const remove = () => {
    if (hideTimer) clearTimeout(hideTimer);
    if (removeTimer) clearTimeout(removeTimer);
    toast.classList.add('admin-toast--leaving');
    removeTimer = setTimeout(() => toast.remove(), 220);
  };
  dismiss.addEventListener('click', remove);

  toast.append(text, dismiss);
  container.append(toast);

  const visibleMs = typeof durationMs === 'number'
    ? durationMs
    : (cleanType === 'error' ? 6500 : 4200);
  hideTimer = setTimeout(remove, visibleMs);
  return toast;
}

/* ------------------------------------------------------------------ */
/* Phase 12: Confirmation modal                                        */
/* ------------------------------------------------------------------ */

/**
 * Show the confirmation dialog and resolve true (confirmed) or false.
 * Falls back to window.confirm when the dialog markup is unavailable.
 */
export function showConfirmationModal({
  title = 'Please confirm',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel'
} = {}) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const dialog = document.getElementById('admin-confirm-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') {
    return Promise.resolve(
      typeof globalThis.confirm === 'function'
        ? globalThis.confirm(message || title)
        : false
    );
  }
  if (dialog.open) return Promise.resolve(false);

  const heading = document.getElementById('confirm-heading');
  const messageEl = document.getElementById('confirm-message');
  const acceptBtn = document.getElementById('confirm-accept');
  const cancelBtn = document.getElementById('confirm-cancel');
  if (heading) heading.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (acceptBtn) acceptBtn.textContent = confirmLabel;
  if (cancelBtn) cancelBtn.textContent = cancelLabel;

  return new Promise(resolve => {
    const onAccept = () => dialog.close('confirm');
    const onCancel = () => dialog.close('cancel');
    const onClose = () => {
      acceptBtn?.removeEventListener('click', onAccept);
      cancelBtn?.removeEventListener('click', onCancel);
      dialog.removeEventListener('close', onClose);
      resolve(dialog.returnValue === 'confirm');
    };
    acceptBtn?.addEventListener('click', onAccept);
    cancelBtn?.addEventListener('click', onCancel);
    dialog.addEventListener('close', onClose);
    dialog.returnValue = '';
    dialog.showModal();
    (cancelBtn || acceptBtn)?.focus?.();
  });
}

export const showConfirmDialog = showConfirmationModal;

/* ------------------------------------------------------------------ */
/* Phase 12: Admin actions (delegate to the booted dashboard)          */
/*                                                                     */
/* The booted dashboard registers its handlers (with access to the     */
/* loaded enquiries, Supabase client and DOM) in activeDashboard-      */
/* Actions. These exported wrappers keep the Phase 12 API surface:     */
/* updateEnquiryStatus(id, newStatus), updateEnquiryNotes(id, notes),  */
/* bulkUpdateStatus(ids, newStatus). All writes go through the         */
/* browser Supabase client (anon key + owner session); RLS enforces.   */
/* ------------------------------------------------------------------ */

let activeDashboardActions = null;

export async function updateEnquiryStatus(id, newStatus) {
  if (!activeDashboardActions) {
    showToast('The dashboard is still loading. Please try again in a moment.', 'error');
    return false;
  }
  return activeDashboardActions.updateEnquiryStatus(id, newStatus);
}

export async function updateEnquiryNotes(id, newNotes) {
  if (!activeDashboardActions) {
    showToast('The dashboard is still loading. Please try again in a moment.', 'error');
    return false;
  }
  return activeDashboardActions.updateEnquiryNotes(id, newNotes);
}

export async function bulkUpdateStatus(ids, newStatus) {
  if (!activeDashboardActions) {
    showToast('The dashboard is still loading. Please try again in a moment.', 'error');
    return false;
  }
  return activeDashboardActions.bulkUpdateStatus(ids, newStatus);
}

/* ------------------------------------------------------------------ */
/* Row / card rendering                                                */
/* ------------------------------------------------------------------ */

function createOpenButton(enquiry, label, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.openEnquiry = enquiryId(enquiry);
  button.setAttribute('aria-label', label);
  button.textContent = label;
  return button;
}

function createSelectCheckbox(enquiry, selected) {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'admin-row-checkbox';
  checkbox.dataset.selectEnquiry = enquiryId(enquiry);
  checkbox.checked = Boolean(selected);
  checkbox.setAttribute(
    'aria-label',
    `Select enquiry for ${displayValue(enquiry.name)}`
  );
  return checkbox;
}

function createInlineStatusSelect(enquiry, updating) {
  const select = document.createElement('select');
  const clean = cleanStatus(enquiry.status);
  const known = STATUS_VALUES.includes(clean);
  select.className = `admin-inline-status admin-status-select-${known ? clean : 'unknown'}`;
  select.dataset.statusEnquiry = enquiryId(enquiry);
  select.setAttribute(
    'aria-label',
    `Change status for ${displayValue(enquiry.name)}`
  );
  if (!known) {
    const unknown = document.createElement('option');
    unknown.value = '';
    unknown.textContent = statusLabel(enquiry.status);
    select.append(unknown);
  }
  for (const value of STATUS_VALUES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = STATUS_LABELS[value];
    select.append(option);
  }
  select.value = known ? clean : '';
  select.disabled = Boolean(updating);
  return select;
}

function createTableRow(enquiry, options = {}) {
  const row = document.createElement('tr');
  row.dataset.enquiryId = enquiryId(enquiry);
  if (options.updating) row.className = 'admin-row--updating';

  const checkboxCell = document.createElement('td');
  checkboxCell.dataset.label = 'Select';
  checkboxCell.className = 'admin-checkbox-cell';
  checkboxCell.append(createSelectCheckbox(enquiry, options.selected));

  const dateCell = document.createElement('td');
  dateCell.dataset.label = 'Date';
  dateCell.textContent = formatEnquiryDate(enquiry.created_at);

  const nameCell = document.createElement('td');
  nameCell.dataset.label = 'Name';
  const nameButton = createOpenButton(
    enquiry,
    displayValue(enquiry.name),
    'admin-name-button'
  );
  nameButton.setAttribute('aria-label', `Open enquiry for ${displayValue(enquiry.name)}`);
  nameCell.append(nameButton);

  const levelCell = document.createElement('td');
  levelCell.dataset.label = 'Level';
  levelCell.textContent = displayValue(enquiry.level);

  const serviceCell = document.createElement('td');
  serviceCell.dataset.label = 'Service';
  serviceCell.textContent = displayValue(enquiry.service);

  const statusCell = document.createElement('td');
  statusCell.dataset.label = 'Status';
  statusCell.className = 'admin-status-cell';
  statusCell.append(createInlineStatusSelect(enquiry, options.updating));

  const actionsCell = document.createElement('td');
  actionsCell.dataset.label = 'Actions';
  actionsCell.className = 'admin-actions-cell';
  actionsCell.append(createOpenButton(enquiry, 'Open', 'admin-open-button'));

  row.append(checkboxCell, dateCell, nameCell, levelCell, serviceCell, statusCell, actionsCell);
  return row;
}

function createMobileCard(enquiry, options = {}) {
  const card = document.createElement('article');
  card.className = `admin-enquiry-card${options.updating ? ' admin-card--updating' : ''}`;
  card.dataset.enquiryId = enquiryId(enquiry);

  const top = document.createElement('div');
  top.className = 'admin-card-topline';
  const selectLabel = document.createElement('label');
  selectLabel.className = 'admin-card-select';
  const selectText = document.createElement('span');
  selectText.textContent = 'Select';
  selectLabel.append(createSelectCheckbox(enquiry, options.selected), selectText);
  const date = document.createElement('span');
  date.textContent = formatEnquiryDate(enquiry.created_at);
  top.append(selectLabel, date);

  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'admin-card-main';
  main.dataset.openEnquiry = enquiryId(enquiry);
  main.setAttribute('aria-label', `Open enquiry for ${displayValue(enquiry.name)}`);
  const name = document.createElement('strong');
  name.className = 'admin-card-name';
  name.textContent = displayValue(enquiry.name);
  const detail = document.createElement('span');
  detail.className = 'admin-card-detail';
  detail.textContent = `${displayValue(enquiry.level)} · ${displayValue(enquiry.service)}`;
  main.append(name, detail);

  const controls = document.createElement('div');
  controls.className = 'admin-card-controls';
  controls.append(createInlineStatusSelect(enquiry, options.updating));

  card.append(top, main, controls);
  return card;
}

function appendDetailField(container, label, value, className = '') {
  const wrapper = document.createElement('div');
  wrapper.className = `admin-detail-field${className ? ` ${className}` : ''}`;
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  description.textContent = displayValue(value);
  wrapper.append(term, description);
  container.append(wrapper);
}

async function fetchAllEnquiries(supabase) {
  const batchSize = 500;
  const enquiries = [];
  let offset = 0;

  // PostgREST applies a row limit. Read ordered pages until the final short page
  // so stats and client-side filters always use the complete visible dataset.
  while (true) {
    const { data, error } = await supabase
      .from('enquiries')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);
    if (error) throw error;

    const page = Array.isArray(data) ? data : [];
    enquiries.push(...page);
    if (page.length < batchSize) break;
    offset += page.length;
  }
  return enquiries;
}

function populateServiceFilter(select, enquiries) {
  const selected = select.value;
  const services = [...new Set(enquiries
    .map(row => String(row?.service || '').trim())
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  select.replaceChildren();
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'All services';
  select.append(allOption);
  for (const service of services) {
    const option = document.createElement('option');
    option.value = service;
    option.textContent = service;
    select.append(option);
  }
  if (services.includes(selected)) select.value = selected;
}

function currentFilters(elements) {
  return {
    status: elements.statusFilter.value,
    level: elements.levelFilter.value,
    service: elements.serviceFilter.value,
    dateRange: elements.dateRange.value,
    dateFrom: elements.dateFrom.value,
    dateTo: elements.dateTo.value,
    search: elements.search.value
  };
}

function updateStats(elements, enquiries) {
  const stats = getEnquiryStats(enquiries);
  elements.statTotal.textContent = String(stats.total);
  elements.statNew.textContent = String(stats.new);
  elements.statWeek.textContent = String(stats.thisWeek);
  elements.statMonth.textContent = String(stats.thisMonth);
}

function updateSortControls(elements, sort) {
  elements.sortButtons.forEach(button => {
    const field = button.dataset.sort;
    const heading = button.closest('th');
    const indicator = button.querySelector('[data-sort-indicator]');
    const isCurrent = field === sort.field;
    if (heading) {
      heading.setAttribute(
        'aria-sort',
        isCurrent ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
      );
    }
    if (indicator) {
      indicator.textContent = isCurrent ? (sort.direction === 'asc' ? '↑' : '↓') : '↕';
    }
  });
}

function buildDetailFields(container, enquiry) {
  container.replaceChildren();
  // Notes are intentionally excluded here: Phase 12 shows them in the
  // dedicated editable "Internal notes" section of the detail panel.
  const fields = [
    ['Name', enquiry.name],
    ['Email', enquiry.email],
    ['Phone', enquiry.phone],
    ['Level', enquiry.level],
    ['Service', enquiry.service],
    ['Title', enquiry.title],
    ['Length', enquiry.length],
    ['Deadline', enquiry.deadline],
    ['Existing draft', enquiry.existing_draft],
    ['Preferred contact', enquiry.preferred_contact]
  ];
  for (const [label, value] of fields) {
    appendDetailField(container, label, value);
  }
}

function startDownload(attachment, button, message, supabase) {
  return async () => {
    if (!attachment || typeof attachment.path !== 'string') {
      message.textContent = 'This attachment is missing its private storage path.';
      message.hidden = false;
      return;
    }

    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = 'Preparing download…';
    message.hidden = true;

    try {
      // Refresh the local session first; the server independently verifies this token.
      const ownerSession = await requireAuth();
      if (!ownerSession) return;
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token || ownerSession.access_token;
      if (!accessToken) throw new Error('No current sign-in token.');

      const response = await fetch(OWNER_DOWNLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ path: attachment.path }),
        cache: 'no-store'
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.url !== 'string') {
        throw new Error(response.status === 401
          ? 'Your session may have expired. Sign in again and retry the download.'
          : 'The attachment could not be prepared. It may have been removed; please try again.');
      }

      const downloadUrl = new URL(result.url, window.location.href);
      if (!['https:', 'http:'].includes(downloadUrl.protocol)) {
        throw new Error('The download link is invalid.');
      }
      const link = document.createElement('a');
      link.href = downloadUrl.href;
      link.download = String(attachment.name || 'attachment');
      link.rel = 'noopener noreferrer';
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
    } catch (error) {
      message.textContent = error?.message && error.message.startsWith('Your session')
        ? error.message
        : 'Could not start the download. The attachment may have been removed, or your connection may be unavailable. Please try again.';
      message.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  };
}

function renderAttachments(container, enquiry, supabase) {
  container.replaceChildren();
  const attachments = getAttachments(enquiry).filter(file => file && typeof file === 'object');
  if (attachments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'admin-detail-muted';
    empty.textContent = 'No files attached to this enquiry.';
    container.append(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'admin-attachment-list';
  for (const attachment of attachments) {
    const item = document.createElement('li');
    const information = document.createElement('div');
    information.className = 'admin-attachment-info';
    const name = document.createElement('strong');
    name.textContent = displayValue(attachment.name);
    const size = document.createElement('span');
    size.textContent = formatFileSize(attachment.size);
    information.append(name, size);

    const actions = document.createElement('div');
    actions.className = 'admin-attachment-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-download-button';
    button.textContent = 'Download';
    const message = document.createElement('p');
    message.className = 'admin-download-error';
    message.setAttribute('role', 'status');
    message.hidden = true;
    button.addEventListener('click', startDownload(attachment, button, message, supabase));
    actions.append(button, message);
    item.append(information, actions);
    list.append(item);
  }
  container.append(list);
}

function readElements() {
  const byId = id => document.getElementById(id);
  return {
    checking: byId('admin-auth-checking'),
    content: byId('admin-dashboard-content'),
    loading: byId('admin-loading'),
    error: byId('admin-load-error'),
    errorRetry: byId('admin-retry-load'),
    dashboardView: byId('admin-dashboard-view'),
    statTotal: byId('stat-total'),
    statNew: byId('stat-new'),
    statWeek: byId('stat-week'),
    statMonth: byId('stat-month'),
    statusFilter: byId('filter-status'),
    levelFilter: byId('filter-level'),
    serviceFilter: byId('filter-service'),
    dateRange: byId('filter-date-range'),
    dateFrom: byId('filter-date-from'),
    dateTo: byId('filter-date-to'),
    customDates: byId('custom-date-fields'),
    search: byId('filter-search'),
    clearFilters: byId('clear-filters'),
    clearFiltersEmpty: byId('clear-filters-empty'),
    exportCsv: byId('export-csv'),
    resultSummary: byId('enquiry-result-summary'),
    listRegion: byId('enquiry-lists'),
    tableBody: byId('enquiry-table-body'),
    mobileCards: byId('enquiry-mobile-cards'),
    noEnquiries: byId('no-enquiries'),
    noMatches: byId('no-matches'),
    loadMore: byId('load-more-enquiries'),
    selectAll: byId('select-all-checkbox'),
    mobileSelectBar: byId('mobile-select-bar'),
    selectAllMobile: byId('select-all-mobile'),
    mobileSelectedCount: byId('mobile-selected-count'),
    bulkBar: byId('bulk-actions-bar'),
    bulkCount: byId('bulk-selected-count'),
    bulkSelect: byId('bulk-status-select'),
    bulkApply: byId('bulk-apply'),
    bulkClear: byId('bulk-clear'),
    sortButtons: [...document.querySelectorAll('[data-sort]')],
    detailDialog: byId('enquiry-detail'),
    detailClose: byId('close-enquiry-detail'),
    detailFooterClose: byId('close-detail-footer'),
    detailHeading: byId('detail-heading'),
    detailReference: byId('detail-reference'),
    detailDate: byId('detail-date'),
    detailStatus: byId('detail-status'),
    detailStatusSelect: byId('detail-status-select'),
    detailStatusState: byId('detail-status-state'),
    detailFields: byId('detail-fields'),
    detailDescription: byId('detail-description'),
    detailNotes: byId('detail-notes'),
    saveNotes: byId('save-notes'),
    notesSaveState: byId('notes-save-state'),
    detailAttachments: byId('detail-attachments'),
    lastFocus: null
  };
}

function bootAdminDashboard() {
  if (typeof document === 'undefined') return;
  const root = document.getElementById('admin-dashboard-page');
  if (!root) return;

  const elements = readElements();
  let enquiries = [];
  let sort = { field: 'created_at', direction: 'desc' };
  let visibleCount = ENQUIRY_PAGE_SIZE;
  let supabase = null;

  // Phase 12 state
  const selectedIds = new Set();
  const pendingStatusIds = new Set();
  let openEnquiryId = null;
  let savedNotesValue = '';
  let notesSaving = false;
  let bulkSaving = false;

  const findEnquiry = id => enquiries.find(item => enquiryId(item) === String(id ?? ''));

  const getFilteredSorted = () => sortEnquiries(
    filterEnquiries(enquiries, currentFilters(elements)),
    sort
  );

  const syncSelectionUI = (matching = getFilteredSorted()) => {
    const count = selectedIds.size;
    // Empty selection state: the bulk bar stays hidden until something is picked.
    if (elements.bulkBar) elements.bulkBar.hidden = count === 0;
    if (elements.bulkCount) {
      elements.bulkCount.textContent = `${count} selected`;
    }
    if (elements.mobileSelectedCount) {
      elements.mobileSelectedCount.textContent = count ? `${count} selected` : '';
    }
    if (elements.bulkSelect) elements.bulkSelect.disabled = bulkSaving;
    if (elements.bulkClear) elements.bulkClear.disabled = bulkSaving || count === 0;
    if (elements.bulkApply) {
      elements.bulkApply.disabled = bulkSaving || count === 0 || !elements.bulkSelect?.value;
      elements.bulkApply.textContent = bulkSaving ? 'Updating…' : 'Apply';
    }
    const filteredIds = matching.map(enquiryId);
    const selectedFiltered = filteredIds.filter(id => selectedIds.has(id)).length;
    if (elements.selectAll) {
      elements.selectAll.checked = filteredIds.length > 0 && selectedFiltered === filteredIds.length;
      elements.selectAll.indeterminate = selectedFiltered > 0 && selectedFiltered < filteredIds.length;
      elements.selectAll.disabled = bulkSaving || filteredIds.length === 0;
    }
    if (elements.selectAllMobile) {
      elements.selectAllMobile.textContent =
        filteredIds.length > 0 && selectedFiltered === filteredIds.length
          ? 'Deselect all'
          : 'Select all';
      elements.selectAllMobile.disabled = bulkSaving || filteredIds.length === 0;
    }
  };

  const syncDetailStatus = enquiry => {
    if (!enquiry || openEnquiryId !== enquiryId(enquiry)) return;
    setStatusBadge(elements.detailStatus, enquiry.status);
    if (elements.detailStatusSelect) {
      const clean = cleanStatus(enquiry.status);
      elements.detailStatusSelect.value = STATUS_VALUES.includes(clean) ? clean : '';
      elements.detailStatusSelect.disabled = pendingStatusIds.has(enquiryId(enquiry));
    }
  };

  const setDetailStatusState = (enquiry, text) => {
    if (!enquiry || openEnquiryId !== enquiryId(enquiry)) return;
    if (elements.detailStatusState) elements.detailStatusState.textContent = text;
  };

  const syncNotesUI = enquiry => {
    if (!enquiry || openEnquiryId !== enquiryId(enquiry)) return;
    if (elements.detailNotes) elements.detailNotes.disabled = notesSaving;
    if (elements.saveNotes) {
      elements.saveNotes.disabled = notesSaving;
      elements.saveNotes.textContent = notesSaving ? 'Saving…' : 'Save notes';
    }
  };

  const setNotesState = (enquiry, text) => {
    if (!enquiry || openEnquiryId !== enquiryId(enquiry)) return;
    if (elements.notesSaveState) elements.notesSaveState.textContent = text;
  };

  const renderList = () => {
    const matching = getFilteredSorted();
    const visible = matching.slice(0, visibleCount);
    elements.tableBody.replaceChildren(...visible.map(enquiry => createTableRow(enquiry, {
      selected: selectedIds.has(enquiryId(enquiry)),
      updating: pendingStatusIds.has(enquiryId(enquiry))
    })));
    elements.mobileCards.replaceChildren(...visible.map(enquiry => createMobileCard(enquiry, {
      selected: selectedIds.has(enquiryId(enquiry)),
      updating: pendingStatusIds.has(enquiryId(enquiry))
    })));
    elements.noEnquiries.hidden = enquiries.length !== 0;
    elements.noMatches.hidden = !(enquiries.length > 0 && matching.length === 0);
    elements.listRegion.hidden = matching.length === 0;
    if (elements.mobileSelectBar) elements.mobileSelectBar.hidden = matching.length === 0;
    if (elements.exportCsv) elements.exportCsv.disabled = matching.length === 0;
    elements.loadMore.hidden = matching.length <= visible.length;
    elements.loadMore.textContent = `Load 50 more (${matching.length - visible.length} remaining)`;
    elements.resultSummary.textContent = matching.length === 0
      ? (enquiries.length === 0 ? 'No enquiries to show.' : 'No enquiries match the selected filters.')
      : `Showing ${visible.length} of ${matching.length} matching ${matching.length === 1 ? 'enquiry' : 'enquiries'}.`;
    updateSortControls(elements, sort);
    syncSelectionUI(matching);
  };

  /* ---------------- Phase 12 actions ---------------- */

  // Optimistic status change: update UI first, write via the browser
  // Supabase client (anon key + owner session; RLS decides), roll back
  // the local copy and UI if Supabase rejects the write.
  const updateStatus = async (id, newStatus) => {
    const idStr = String(id ?? '');
    const clean = cleanStatus(newStatus);
    const enquiry = findEnquiry(idStr);
    if (!supabase) {
      showToast('The dashboard is still loading. Please try again in a moment.', 'error');
      return false;
    }
    if (!STATUS_VALUES.includes(clean)) {
      showToast('Please choose a valid status.', 'error');
      if (enquiry) { renderList(); syncDetailStatus(enquiry); }
      return false;
    }
    if (!enquiry) {
      showToast('That enquiry could not be found. Please refresh and try again.', 'error');
      return false;
    }
    if (cleanStatus(enquiry.status) === clean) {
      syncDetailStatus(enquiry);
      return true;
    }
    if (pendingStatusIds.has(idStr)) return false;

    const previousStatus = enquiry.status;
    pendingStatusIds.add(idStr);
    enquiry.status = clean; // optimistic
    updateStats(elements, enquiries);
    renderList();
    syncDetailStatus(enquiry);
    setDetailStatusState(enquiry, 'Saving…');

    try {
      const { data, error } = await supabase
        .from('enquiries')
        .update({ status: clean })
        .eq('id', enquiry.id)
        .select('id, status');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('The update was not applied. You may not have permission, or the enquiry may have been removed.');
      }
      pendingStatusIds.delete(idStr);
      updateStats(elements, enquiries);
      renderList();
      syncDetailStatus(enquiry);
      setDetailStatusState(enquiry, '');
      showToast(`Status updated to ${STATUS_LABELS[clean]}.`, 'success');
      return true;
    } catch (error) {
      enquiry.status = previousStatus; // rollback
      pendingStatusIds.delete(idStr);
      updateStats(elements, enquiries);
      renderList();
      syncDetailStatus(enquiry);
      setDetailStatusState(enquiry, '');
      showToast(
        `Could not update status. ${friendlyError(error, 'Please check your connection and try again.')}`,
        'error'
      );
      return false;
    }
  };

  // Optimistic notes save. Clearing notes is confirmed by the caller
  // (detail panel) before this runs — see saveDetailNotes below.
  const updateNotes = async (id, newNotes) => {
    const idStr = String(id ?? '');
    const enquiry = findEnquiry(idStr);
    if (!supabase) {
      showToast('The dashboard is still loading. Please try again in a moment.', 'error');
      return false;
    }
    if (!enquiry) {
      showToast('That enquiry could not be found. Please refresh and try again.', 'error');
      return false;
    }
    if (notesSaving) return false;

    const text = String(newNotes ?? '');
    const previousNotes = enquiry.notes;
    if (text === String(previousNotes ?? '')) {
      savedNotesValue = text;
      setNotesState(enquiry, text ? 'Saved' : '');
      return true;
    }

    enquiry.notes = text; // optimistic (CSV export reads this local copy)
    notesSaving = true;
    syncNotesUI(enquiry);
    setNotesState(enquiry, 'Saving…');

    try {
      const { data, error } = await supabase
        .from('enquiries')
        .update({ notes: text })
        .eq('id', enquiry.id)
        .select('id, notes');
      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('The update was not applied. You may not have permission, or the enquiry may have been removed.');
      }
      notesSaving = false;
      savedNotesValue = text;
      syncNotesUI(enquiry);
      setNotesState(enquiry, 'Saved');
      showToast('Notes saved.', 'success');
      return true;
    } catch (error) {
      enquiry.notes = previousNotes; // rollback
      notesSaving = false;
      if (openEnquiryId === idStr && elements.detailNotes) {
        elements.detailNotes.value = String(previousNotes ?? '');
      }
      savedNotesValue = String(previousNotes ?? '');
      syncNotesUI(enquiry);
      setNotesState(enquiry, '');
      showToast(
        `Could not save notes. ${friendlyError(error, 'Please check your connection and try again.')}`,
        'error'
      );
      return false;
    }
  };

  // Bulk status change: one .in() update, optimistic locally, full
  // rollback if Supabase does not confirm every row. Selection is only
  // cleared on success (handled here) so a failure can be retried.
  const bulkStatus = async (ids, newStatus) => {
    const clean = cleanStatus(newStatus);
    if (!supabase) {
      showToast('The dashboard is still loading. Please try again in a moment.', 'error');
      return false;
    }
    if (!STATUS_VALUES.includes(clean)) {
      showToast('Please choose a valid status.', 'error');
      return false;
    }
    const uniqueIds = [...new Set((Array.isArray(ids) ? ids : []).map(value => String(value ?? '')))];
    const targets = uniqueIds.map(findEnquiry).filter(Boolean);
    if (targets.length === 0) {
      showToast('Select at least one enquiry first.', 'info');
      return false;
    }
    if (bulkSaving) return false;

    const previousStatuses = new Map(targets.map(enquiry => [enquiryId(enquiry), enquiry.status]));
    bulkSaving = true;
    for (const enquiry of targets) {
      pendingStatusIds.add(enquiryId(enquiry));
      enquiry.status = clean; // optimistic
    }
    updateStats(elements, enquiries);
    renderList();
    if (openEnquiryId) {
      const open = findEnquiry(openEnquiryId);
      if (open) syncDetailStatus(open);
    }

    try {
      const { data, error } = await supabase
        .from('enquiries')
        .update({ status: clean })
        .in('id', targets.map(enquiry => enquiry.id))
        .select('id, status');
      if (error) throw error;
      if (!Array.isArray(data) || data.length !== targets.length) {
        throw new Error('Not every selected enquiry could be updated. No changes were kept — please try again.');
      }
      for (const enquiry of targets) pendingStatusIds.delete(enquiryId(enquiry));
      bulkSaving = false;
      selectedIds.clear();
      if (elements.bulkSelect) elements.bulkSelect.value = '';
      updateStats(elements, enquiries);
      renderList(); // refresh the list from the updated local copy
      if (openEnquiryId) {
        const open = findEnquiry(openEnquiryId);
        if (open) syncDetailStatus(open);
      }
      showToast(
        `Updated ${targets.length} ${targets.length === 1 ? 'enquiry' : 'enquiries'} to ${STATUS_LABELS[clean]}.`,
        'success'
      );
      return true;
    } catch (error) {
      for (const enquiry of targets) {
        enquiry.status = previousStatuses.get(enquiryId(enquiry)); // rollback
        pendingStatusIds.delete(enquiryId(enquiry));
      }
      bulkSaving = false;
      updateStats(elements, enquiries);
      renderList();
      if (openEnquiryId) {
        const open = findEnquiry(openEnquiryId);
        if (open) syncDetailStatus(open);
      }
      showToast(
        `Could not update the selected enquiries. ${friendlyError(error, 'Please check your connection and try again.')}`,
        'error'
      );
      return false;
    }
  };

  activeDashboardActions = {
    updateEnquiryStatus: updateStatus,
    updateEnquiryNotes: updateNotes,
    bulkUpdateStatus: bulkStatus
  };

  const showDetail = (enquiry, returnFocus) => {
    if (!enquiry) return;
    openEnquiryId = enquiryId(enquiry);
    elements.detailHeading.textContent = displayValue(enquiry.name) === '—'
      ? 'Enquiry details'
      : displayValue(enquiry.name);
    elements.detailReference.textContent = enquiryId(enquiry).slice(0, 8) || '—';
    elements.detailDate.textContent = formatEnquiryDate(enquiry.created_at);
    setStatusBadge(elements.detailStatus, enquiry.status);
    buildDetailFields(elements.detailFields, enquiry);
    elements.detailDescription.textContent = displayValue(enquiry.description);
    if (elements.detailStatusSelect) {
      const clean = cleanStatus(enquiry.status);
      elements.detailStatusSelect.value = STATUS_VALUES.includes(clean) ? clean : '';
      elements.detailStatusSelect.disabled = pendingStatusIds.has(openEnquiryId);
    }
    if (elements.detailStatusState) elements.detailStatusState.textContent = '';
    savedNotesValue = String(enquiry.notes ?? '');
    if (elements.detailNotes) {
      elements.detailNotes.value = savedNotesValue;
      elements.detailNotes.disabled = notesSaving;
    }
    if (elements.saveNotes) {
      elements.saveNotes.disabled = notesSaving;
      elements.saveNotes.textContent = notesSaving ? 'Saving…' : 'Save notes';
    }
    if (elements.notesSaveState) elements.notesSaveState.textContent = '';
    renderAttachments(elements.detailAttachments, enquiry, supabase);
    elements.detailDialog.returnValue = '';
    elements.detailDialog.showModal();
    elements.detailClose.focus();
    elements.lastFocus = returnFocus || document.activeElement;
  };

  // Save notes from the detail panel (Save button or blur). Clearing a
  // non-empty note to empty always asks for confirmation first.
  const saveDetailNotes = async () => {
    if (!openEnquiryId || notesSaving || !elements.detailNotes) return;
    const enquiry = findEnquiry(openEnquiryId);
    if (!enquiry) return;
    const value = elements.detailNotes.value;
    if (value === savedNotesValue) {
      setNotesState(enquiry, savedNotesValue ? 'Saved' : '');
      return;
    }
    if (value.trim() === '' && savedNotesValue.trim() !== '') {
      const confirmed = await showConfirmationModal({
        title: 'Clear notes?',
        message: 'This will clear the internal notes for this enquiry. This cannot be undone.',
        confirmLabel: 'Clear notes',
        cancelLabel: 'Keep notes'
      });
      if (!confirmed) {
        elements.detailNotes.value = savedNotesValue;
        setNotesState(enquiry, '');
        elements.detailNotes.focus();
        return;
      }
    }
    await updateNotes(openEnquiryId, value);
  };

  const loadEnquiries = async () => {
    elements.error.hidden = true;
    elements.dashboardView.hidden = true;
    elements.loading.hidden = false;
    try {
      if (!supabase) supabase = await getSupabaseClient();
      enquiries = await fetchAllEnquiries(supabase);
      selectedIds.clear();
      if (elements.bulkSelect) elements.bulkSelect.value = '';
      populateServiceFilter(elements.serviceFilter, enquiries);
      updateStats(elements, enquiries);
      elements.loading.hidden = true;
      elements.dashboardView.hidden = false;
      renderList();
    } catch {
      // Avoid showing raw backend errors or enquiry data in the page or console.
      elements.loading.hidden = true;
      elements.dashboardView.hidden = true;
      elements.error.hidden = false;
    }
  };

  const resetFilters = () => {
    elements.statusFilter.value = '';
    elements.levelFilter.value = '';
    elements.serviceFilter.value = '';
    elements.dateRange.value = 'all';
    elements.dateFrom.value = '';
    elements.dateTo.value = '';
    elements.search.value = '';
    elements.customDates.hidden = true;
    visibleCount = ENQUIRY_PAGE_SIZE;
    renderList();
  };

  const updateDateControls = () => {
    elements.customDates.hidden = elements.dateRange.value !== 'custom';
    visibleCount = ENQUIRY_PAGE_SIZE;
    renderList();
  };

  const handleSelectionChange = target => {
    const id = target.dataset.selectEnquiry;
    if (target.checked) selectedIds.add(id);
    else selectedIds.delete(id);
    syncSelectionUI();
  };

  const handleStatusChange = target => {
    void updateStatus(target.dataset.statusEnquiry, target.value);
  };

  const toggleSelectAllFiltered = select => {
    const matching = getFilteredSorted();
    for (const enquiry of matching) {
      if (select) selectedIds.add(enquiryId(enquiry));
      else selectedIds.delete(enquiryId(enquiry));
    }
    renderList();
  };

  elements.clearFilters.addEventListener('click', resetFilters);
  elements.clearFiltersEmpty.addEventListener('click', resetFilters);
  elements.errorRetry.addEventListener('click', loadEnquiries);
  elements.statusFilter.addEventListener('change', () => { visibleCount = ENQUIRY_PAGE_SIZE; renderList(); });
  elements.levelFilter.addEventListener('change', () => { visibleCount = ENQUIRY_PAGE_SIZE; renderList(); });
  elements.serviceFilter.addEventListener('change', () => { visibleCount = ENQUIRY_PAGE_SIZE; renderList(); });
  elements.dateRange.addEventListener('change', updateDateControls);
  elements.dateFrom.addEventListener('input', () => { visibleCount = ENQUIRY_PAGE_SIZE; renderList(); });
  elements.dateTo.addEventListener('input', () => { visibleCount = ENQUIRY_PAGE_SIZE; renderList(); });
  elements.search.addEventListener('input', () => { visibleCount = ENQUIRY_PAGE_SIZE; renderList(); });
  elements.loadMore.addEventListener('click', () => {
    visibleCount += ENQUIRY_PAGE_SIZE;
    renderList();
  });
  elements.sortButtons.forEach(button => {
    button.addEventListener('click', () => {
      const field = button.dataset.sort;
      if (!['created_at', 'name', 'level', 'status'].includes(field)) return;
      if (sort.field === field) {
        sort = { field, direction: sort.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        sort = { field, direction: field === 'created_at' ? 'desc' : 'asc' };
      }
      visibleCount = ENQUIRY_PAGE_SIZE;
      renderList();
    });
  });

  // Phase 12: CSV export of the currently filtered + sorted list only.
  elements.exportCsv?.addEventListener('click', () => {
    const matching = getFilteredSorted();
    if (matching.length === 0) {
      showToast('No enquiries match the current filters to export.', 'info');
      return;
    }
    const result = exportToCSV(matching);
    showToast(
      `Exported ${result.count} ${result.count === 1 ? 'enquiry' : 'enquiries'} to ${result.filename}.`,
      'success'
    );
  });

  // Phase 12: selection + inline status (change events bubble from rows/cards).
  elements.tableBody.addEventListener('change', event => {
    if (event.target.matches('[data-select-enquiry]')) handleSelectionChange(event.target);
    else if (event.target.matches('[data-status-enquiry]')) handleStatusChange(event.target);
  });
  elements.mobileCards.addEventListener('change', event => {
    if (event.target.matches('[data-select-enquiry]')) handleSelectionChange(event.target);
    else if (event.target.matches('[data-status-enquiry]')) handleStatusChange(event.target);
  });
  elements.selectAll?.addEventListener('change', () => {
    toggleSelectAllFiltered(elements.selectAll.checked);
  });
  elements.selectAllMobile?.addEventListener('click', () => {
    const matching = getFilteredSorted();
    const allSelected = matching.length > 0
      && matching.every(enquiry => selectedIds.has(enquiryId(enquiry)));
    toggleSelectAllFiltered(!allSelected);
  });
  elements.bulkSelect?.addEventListener('change', () => syncSelectionUI());
  elements.bulkClear?.addEventListener('click', () => {
    if (selectedIds.size === 0) return;
    selectedIds.clear();
    renderList();
    showToast('Selection cleared.', 'info');
  });
  elements.bulkApply?.addEventListener('click', async () => {
    const newStatus = elements.bulkSelect?.value || '';
    const ids = [...selectedIds];
    if (ids.length === 0) {
      showToast('Select at least one enquiry first.', 'info');
      return;
    }
    if (!STATUS_VALUES.includes(newStatus)) {
      showToast('Choose a status from the “Mark as…” list first.', 'info');
      elements.bulkSelect?.focus();
      return;
    }
    const confirmed = await showConfirmationModal({
      title: 'Update selected enquiries?',
      message: `Change ${ids.length} selected ${ids.length === 1 ? 'enquiry' : 'enquiries'} to “${STATUS_LABELS[newStatus]}”?`,
      confirmLabel: 'Update status',
      cancelLabel: 'Cancel'
    });
    if (!confirmed) return;
    await bulkStatus(ids, newStatus);
  });

  elements.tableBody.addEventListener('click', event => {
    if (event.target.closest('[data-select-enquiry], [data-status-enquiry]')) return;
    const button = event.target.closest('[data-open-enquiry]');
    const row = event.target.closest('tr[data-enquiry-id]');
    const selectedId = button?.dataset.openEnquiry || row?.dataset.enquiryId;
    if (!selectedId) return;
    const selected = findEnquiry(selectedId);
    const returnFocus = button || row?.querySelector('[data-open-enquiry]') || null;
    showDetail(selected, returnFocus);
  });
  elements.mobileCards.addEventListener('click', event => {
    if (event.target.closest('[data-select-enquiry], [data-status-enquiry], label')) return;
    const button = event.target.closest('[data-open-enquiry]');
    if (!button) return;
    const selected = findEnquiry(button.dataset.openEnquiry);
    showDetail(selected, button);
  });

  // Phase 12: detail panel status + notes.
  elements.detailStatusSelect?.addEventListener('change', () => {
    if (!openEnquiryId) return;
    void updateStatus(openEnquiryId, elements.detailStatusSelect.value);
  });
  elements.saveNotes?.addEventListener('click', () => { void saveDetailNotes(); });
  elements.detailNotes?.addEventListener('blur', () => { void saveDetailNotes(); });

  elements.detailClose.addEventListener('click', () => elements.detailDialog.close());
  elements.detailFooterClose.addEventListener('click', () => elements.detailDialog.close());
  elements.detailDialog.addEventListener('click', event => {
    if (event.target === elements.detailDialog) elements.detailDialog.close();
  });
  elements.detailDialog.addEventListener('close', () => {
    openEnquiryId = null;
    elements.lastFocus?.focus?.();
    elements.lastFocus = null;
  });

  elements.dashboardView.hidden = true;
  elements.loading.hidden = false;
  elements.error.hidden = true;

  // Auth is checked here as well as by the shared Phase 10 page shell before reads begin.
  requireAuth().then(session => {
    if (session) return loadEnquiries();
  }).catch(() => {
    elements.loading.hidden = true;
    elements.error.hidden = false;
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootAdminDashboard, { once: true });
  } else {
    bootAdminDashboard();
  }
}
