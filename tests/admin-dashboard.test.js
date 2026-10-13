import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ENQUIRY_PAGE_SIZE,
  filterEnquiries,
  formatEnquiryDate,
  formatFileSize,
  getEnquiryStats,
  sortEnquiries
} from '../js/admin-dashboard.js';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const enquiries = [
  {
    id: 'one', created_at: '2026-10-13T10:00:00.000Z', name: 'Ama Mensah',
    email: 'ama@example.com', phone: '+233 20 123 4567', description: 'Review my research proposal',
    level: 'MSc', service: 'Research Support', status: 'new'
  },
  {
    id: 'two', created_at: '2026-10-10T10:00:00.000Z', name: 'Kofi Owusu',
    email: 'kofi@example.com', phone: '0240000000', description: 'Help with slide structure',
    level: 'BSc', service: 'Assignments & Presentations', status: 'quoted'
  },
  {
    id: 'three', created_at: '2026-10-01T10:00:00.000Z', name: 'Akua Boateng',
    email: 'akua@example.com', phone: '0550000000', description: 'Academic editing request',
    level: 'Other', service: 'Editing & Formatting', status: 'new'
  },
  {
    id: 'four', created_at: '2026-09-30T10:00:00.000Z', name: 'Yaw Asare',
    email: 'yaw@example.com', phone: '0200000000', description: 'Old enquiry',
    level: 'BSN', service: 'BSN Case Studies', status: 'archived'
  },
  {
    id: 'future', created_at: '2026-10-14T10:00:00.000Z', name: 'Future Record',
    email: 'future@example.com', phone: '', description: '', level: 'BSc', service: 'Research Support', status: 'new'
  }
];

test('dashboard statistics count all records and the requested date windows', () => {
  assert.deepEqual(getEnquiryStats(enquiries, NOW), {
    total: 5,
    new: 3,
    thisWeek: 2,
    thisMonth: 3
  });
});

test('status, level, service, date range, and text search filters combine', () => {
  const filtered = filterEnquiries(enquiries, {
    status: 'new',
    level: 'MSc',
    service: 'research support',
    dateRange: '7d',
    search: 'AMA@EXAMPLE.COM'
  }, NOW);
  assert.deepEqual(filtered.map(row => row.id), ['one']);

  assert.deepEqual(filterEnquiries(enquiries, { search: '0200000000' }, NOW).map(row => row.id), ['four']);
  assert.deepEqual(filterEnquiries(enquiries, { dateRange: '30d' }, NOW).map(row => row.id), ['one', 'two', 'three', 'four']);
  assert.deepEqual(filterEnquiries(enquiries, {
    dateRange: 'custom', dateFrom: '2026-10-01', dateTo: '2026-10-10'
  }, NOW).map(row => row.id), ['two', 'three']);
});

test('sorting supports the four dashboard columns and preserves the original list', () => {
  const originalIds = enquiries.map(row => row.id);
  assert.deepEqual(sortEnquiries(enquiries, { field: 'created_at', direction: 'desc' }).map(row => row.id), [
    'future', 'one', 'two', 'three', 'four'
  ]);
  assert.deepEqual(sortEnquiries(enquiries, { field: 'name', direction: 'asc' }).map(row => row.name), [
    'Akua Boateng', 'Ama Mensah', 'Future Record', 'Kofi Owusu', 'Yaw Asare'
  ]);
  assert.deepEqual(sortEnquiries(enquiries, { field: 'status', direction: 'asc' }).map(row => row.id), [
    'four', 'one', 'three', 'future', 'two'
  ]);
  assert.deepEqual(enquiries.map(row => row.id), originalIds);
  assert.equal(ENQUIRY_PAGE_SIZE, 50);
});

test('date and file-size formatting are friendly for missing and real values', () => {
  assert.equal(formatEnquiryDate('2026-10-12T12:00:00.000Z'), '12 Oct 2026');
  assert.equal(formatEnquiryDate('not-a-date'), '—');
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(1536), '1.5 KB');
  assert.equal(formatFileSize(1_572_864), '1.5 MB');
  assert.equal(formatFileSize(null), 'Size unavailable');
});
