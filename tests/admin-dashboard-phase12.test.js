import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CSV_HEADERS,
  STATUS_LABELS,
  STATUS_VALUES,
  buildCsvContent,
  bulkUpdateStatus,
  escapeCsvField,
  exportToCSV,
  getCsvFilename,
  getStatusLabel,
  showConfirmationModal,
  showToast,
  updateEnquiryNotes,
  updateEnquiryStatus
} from '../js/admin-dashboard.js';

const enquiries = [
  {
    id: '12345678-abcd-ef00-1234-567890abcdef',
    created_at: '2026-10-13T10:30:00.000Z',
    name: 'Ama Mensah, Jr.',
    email: 'ama@example.com',
    phone: '+233 20 123 4567',
    level: 'MSc',
    service: 'Research Support',
    title: 'He said "hello"',
    description: 'First line\nSecond line, with comma',
    length: '20 pages',
    deadline: '2026-11-01',
    existing_draft: 'Yes',
    preferred_contact: 'WhatsApp',
    notes: 'Call after 5pm, "urgent"',
    status: 'in_progress',
    file_paths: [
      { name: 'draft.pdf', path: 'enquiries/x/draft.pdf', size: 1024 },
      { name: 'data.xlsx', path: 'enquiries/x/data.xlsx', size: 2048 }
    ]
  },
  {
    id: '87654321-abcd-ef00-1234-567890abcdef',
    created_at: '2026-10-10T09:00:00.000Z',
    name: 'Kofi Owusu',
    email: 'kofi@example.com',
    phone: '0240000000',
    level: 'BSc',
    service: 'Assignments & Presentations',
    title: '',
    description: 'Help with slide structure',
    length: '',
    deadline: '2026-10-20',
    existing_draft: 'No',
    preferred_contact: 'Email',
    notes: '',
    status: 'new',
    file_paths: null
  }
];

test('Phase 12 status values and display labels are exact', () => {
  assert.deepEqual([...STATUS_VALUES], [
    'new', 'quoted', 'in_progress', 'delivered', 'paid', 'archived'
  ]);
  assert.deepEqual({ ...STATUS_LABELS }, {
    new: 'New',
    quoted: 'Quoted',
    in_progress: 'In Progress',
    delivered: 'Delivered',
    paid: 'Paid',
    archived: 'Archived'
  });
  assert.equal(getStatusLabel('in_progress'), 'In Progress');
  assert.equal(getStatusLabel(''), 'Unknown');
});

test('CSV headers are in the Phase 12 order', () => {
  assert.deepEqual([...CSV_HEADERS], [
    'Reference', 'Created At', 'Name', 'Email', 'Phone', 'Level', 'Service',
    'Title', 'Description', 'Length', 'Deadline', 'Existing Draft',
    'Preferred Contact', 'Notes', 'Status', 'File Count'
  ]);
  const firstLine = buildCsvContent(enquiries).split('\r\n')[0];
  assert.equal(firstLine.replace(/^﻿/, ''), CSV_HEADERS.join(','));
});

test('CSV starts with a UTF-8 BOM and uses CRLF line endings', () => {
  const content = buildCsvContent(enquiries);
  assert.equal(content.charCodeAt(0), 0xfeff);
  assert.ok(content.endsWith('\r\n'));
  assert.equal(content.split('\r\n').length, 4); // header + 2 rows + trailing
});

test('CSV escapes commas, quotes and newlines, and counts files', () => {
  assert.equal(escapeCsvField('a,b'), '"a,b"');
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvField('one\ntwo'), '"one\ntwo"');
  assert.equal(escapeCsvField('plain'), 'plain');
  assert.equal(escapeCsvField(null), '');

  const lines = buildCsvContent(enquiries).replace(/^﻿/, '').split('\r\n');
  // Row 1 fields containing commas/quotes/newlines must be quoted.
  assert.ok(lines[1].startsWith('12345678,2026-10-13T10:30:00.000Z,"Ama Mensah, Jr.",'));
  assert.ok(lines[1].includes('"He said ""hello"""'));
  assert.ok(lines[1].includes('"First line\nSecond line, with comma"'));
  assert.ok(lines[1].includes('"Call after 5pm, ""urgent"""'));
  assert.ok(lines[1].endsWith(',In Progress,2'));
  // Row 2: no attachments -> file count 0, status label exported.
  assert.ok(lines[2].endsWith(',New,0'));
});

test('CSV only contains the enquiries it is given (filtered list)', () => {
  const content = buildCsvContent([enquiries[1]]);
  assert.ok(content.includes('Kofi Owusu'));
  assert.ok(!content.includes('Ama Mensah'));
  assert.equal(buildCsvContent([]).split('\r\n')[0].replace(/^﻿/, ''), CSV_HEADERS.join(','));
});

test('CSV filename uses the local date in jas-enquiries-YYYY-MM-DD.csv format', () => {
  assert.equal(getCsvFilename(new Date(2026, 9, 13, 15, 30)), 'jas-enquiries-2026-10-13.csv');
  assert.equal(getCsvFilename(new Date(2026, 0, 5)), 'jas-enquiries-2026-01-05.csv');
});

test('exportToCSV returns filename/content/count without a DOM (no download)', () => {
  const result = exportToCSV([enquiries[0]], new Date(2026, 9, 13));
  assert.equal(result.filename, 'jas-enquiries-2026-10-13.csv');
  assert.equal(result.count, 1);
  assert.ok(result.content.includes('Ama Mensah'));
});

test('toast, confirmation and action wrappers are safe before the dashboard boots', async () => {
  // Node has no document: these must not throw. The dashboard only
  // registers its action handlers once booted in the browser.
  assert.equal(showToast('Saved.', 'success'), null);
  assert.equal(await showConfirmationModal({ message: 'Continue?' }), false);
  assert.equal(await updateEnquiryStatus('12345678', 'paid'), false);
  assert.equal(await updateEnquiryNotes('12345678', 'note'), false);
  assert.equal(await bulkUpdateStatus(['12345678'], 'paid'), false);
});
