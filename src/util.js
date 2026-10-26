'use strict';

const { TEXT_EXT, IMAGE_EXT } = require('./constants');

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const pad = (n) => String(n).padStart(2, '0');

/** «6 мая 2026, 12:30» */
function formatDate(value) {
  if (value === null || value === undefined) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «2026-05-06 12-30» — для имён файлов */
function fileStamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function relativeAge(value) {
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} дн назад`;
  return formatDate(value);
}

function parseStamp(d8, t6) {
  return new Date(
    Number(d8.slice(0, 4)), Number(d8.slice(4, 6)) - 1, Number(d8.slice(6, 8)),
    Number(t6.slice(0, 2)), Number(t6.slice(2, 4)), Number(t6.slice(4, 6)),
  );
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function basename(p) { const i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }
function dirname(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function joinPath(...parts) {
  return parts.filter((x) => x !== undefined && x !== null && x !== '').join('/').replace(/\/+/g, '/').replace(/^\.\//, '');
}
function extOf(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase();
}
function splitExt(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  const dir = dirname(p);
  if (i <= 0) return { dir, stem: b, ext: '' };
  return { dir, stem: b.slice(0, i), ext: b.slice(i) };
}

function fileKind(p) {
  const e = extOf(p);
  if (IMAGE_EXT.includes(e) && e !== 'svg') return 'image';
  if (TEXT_EXT.includes(e)) return 'text';
  if (!e) return 'text';
  return 'binary';
}

function mimeOf(p) {
  const e = extOf(p);
  const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic', svg: 'image/svg+xml' };
  return map[e] || 'application/octet-stream';
}

function sameBuffers(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

function looksBinary(buf) {
  const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8000));
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0) return true;
  return false;
}

function isAbsolutePath(p) {
  return /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(p || '');
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

module.exports = {
  formatDate, fileStamp, relativeAge, parseStamp, formatSize, basename, dirname, joinPath,
  extOf, splitExt, fileKind, mimeOf, sameBuffers, looksBinary, isAbsolutePath, plural, pad,
};
