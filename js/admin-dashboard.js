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
  const clean = String(status || '').trim().toLowerCase();
  if (!clean) return 'Unknown';
  return clean.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function setStatusBadge(element, status) {
  if (!element) return;
  const clean = String(status || '').trim().toLowerCase();
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

function createOpenButton(enquiry, label, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.openEnquiry = String(enquiry.id ?? '');
  button.setAttribute('aria-label', label);
  button.textContent = label;
  return button;
}

function createTableRow(enquiry) {
  const row = document.createElement('tr');
  row.dataset.enquiryId = String(enquiry.id ?? '');
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
  statusCell.append(createStatusBadge(enquiry.status));

  const actionsCell = document.createElement('td');
  actionsCell.dataset.label = 'Actions';
  actionsCell.className = 'admin-actions-cell';
  actionsCell.append(createOpenButton(enquiry, 'Open', 'admin-open-button'));

  row.append(dateCell, nameCell, levelCell, serviceCell, statusCell, actionsCell);
  return row;
}

function createMobileCard(enquiry) {
  const button = createOpenButton(
    enquiry,
    `Open enquiry for ${displayValue(enquiry.name)}`,
    'admin-enquiry-card'
  );

  const top = document.createElement('span');
  top.className = 'admin-card-topline';
  const date = document.createElement('span');
  date.textContent = formatEnquiryDate(enquiry.created_at);
  top.append(date, createStatusBadge(enquiry.status));

  const name = document.createElement('strong');
  name.className = 'admin-card-name';
  name.textContent = displayValue(enquiry.name);

  const detail = document.createElement('span');
  detail.className = 'admin-card-detail';
  detail.textContent = `${displayValue(enquiry.level)} · ${displayValue(enquiry.service)}`;

  button.append(top, name, detail);
  return button;
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
    ['Preferred contact', enquiry.preferred_contact],
    ['Notes', enquiry.notes]
  ];
  for (const [label, value] of fields) {
    appendDetailField(container, label, value, label === 'Notes' ? 'admin-detail-field--wide' : '');
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

function showEnquiryDetail(enquiry, elements, supabase, returnFocus) {
  if (!enquiry) return;
  elements.detailHeading.textContent = displayValue(enquiry.name) === '—'
    ? 'Enquiry details'
    : displayValue(enquiry.name);
  elements.detailReference.textContent = String(enquiry.id || '').slice(0, 8) || '—';
  elements.detailDate.textContent = formatEnquiryDate(enquiry.created_at);
  setStatusBadge(elements.detailStatus, enquiry.status);
  buildDetailFields(elements.detailFields, enquiry);
  elements.detailDescription.textContent = displayValue(enquiry.description);
  renderAttachments(elements.detailAttachments, enquiry, supabase);
  elements.detailDialog.returnValue = '';
  elements.detailDialog.showModal();
  elements.detailClose.focus();
  elements.lastFocus = returnFocus || document.activeElement;
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
    resultSummary: byId('enquiry-result-summary'),
    listRegion: byId('enquiry-lists'),
    tableBody: byId('enquiry-table-body'),
    mobileCards: byId('enquiry-mobile-cards'),
    noEnquiries: byId('no-enquiries'),
    noMatches: byId('no-matches'),
    loadMore: byId('load-more-enquiries'),
    sortButtons: [...document.querySelectorAll('[data-sort]')],
    detailDialog: byId('enquiry-detail'),
    detailClose: byId('close-enquiry-detail'),
    detailFooterClose: byId('close-detail-footer'),
    detailHeading: byId('detail-heading'),
    detailReference: byId('detail-reference'),
    detailDate: byId('detail-date'),
    detailStatus: byId('detail-status'),
    detailFields: byId('detail-fields'),
    detailDescription: byId('detail-description'),
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

  const renderList = () => {
    const matching = sortEnquiries(filterEnquiries(enquiries, currentFilters(elements)), sort);
    const visible = matching.slice(0, visibleCount);
    elements.tableBody.replaceChildren(...visible.map(createTableRow));
    elements.mobileCards.replaceChildren(...visible.map(createMobileCard));
    elements.noEnquiries.hidden = enquiries.length !== 0;
    elements.noMatches.hidden = !(enquiries.length > 0 && matching.length === 0);
    elements.listRegion.hidden = matching.length === 0;
    elements.loadMore.hidden = matching.length <= visible.length;
    elements.loadMore.textContent = `Load 50 more (${matching.length - visible.length} remaining)`;
    elements.resultSummary.textContent = matching.length === 0
      ? (enquiries.length === 0 ? 'No enquiries to show.' : 'No enquiries match the selected filters.')
      : `Showing ${visible.length} of ${matching.length} matching ${matching.length === 1 ? 'enquiry' : 'enquiries'}.`;
    updateSortControls(elements, sort);
  };

  const loadEnquiries = async () => {
    elements.error.hidden = true;
    elements.dashboardView.hidden = true;
    elements.loading.hidden = false;
    try {
      if (!supabase) supabase = await getSupabaseClient();
      enquiries = await fetchAllEnquiries(supabase);
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
  elements.tableBody.addEventListener('click', event => {
    const button = event.target.closest('[data-open-enquiry]');
    const row = event.target.closest('tr[data-enquiry-id]');
    const enquiryId = button?.dataset.openEnquiry || row?.dataset.enquiryId;
    if (!enquiryId) return;
    const selected = enquiries.find(item => String(item.id ?? '') === enquiryId);
    const returnFocus = button || row?.querySelector('[data-open-enquiry]') || null;
    showEnquiryDetail(selected, elements, supabase, returnFocus);
  });
  elements.mobileCards.addEventListener('click', event => {
    const button = event.target.closest('[data-open-enquiry]');
    if (!button) return;
    const selected = enquiries.find(row => String(row.id ?? '') === button.dataset.openEnquiry);
    showEnquiryDetail(selected, elements, supabase, button);
  });
  elements.detailClose.addEventListener('click', () => elements.detailDialog.close());
  elements.detailFooterClose.addEventListener('click', () => elements.detailDialog.close());
  elements.detailDialog.addEventListener('click', event => {
    if (event.target === elements.detailDialog) elements.detailDialog.close();
  });
  elements.detailDialog.addEventListener('close', () => {
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
