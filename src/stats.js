'use strict';
/**
 * Статистика конфликтов.
 *  detected — каждая конфликтная копия, впервые замеченная при сканировании
 *  журнал   — каждое решение (см. journal.js)
 * Вместе они дают: сколько появилось, сколько решено, за сколько, откуда и где.
 */

const { dirname, pad } = require('./util');

const DAY = 864e5;
const MAX_DETECTED = 3000;

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function countBy(list, keyFn) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (k === null || k === undefined) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function median(nums) {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} мин`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} ч`;
  return `${Math.round(h / 24)} дн`;
}

class Stats {
  constructor(core, data) {
    this.core = core;
    this.detected = data && Array.isArray(data.detected) ? data.detected : [];
    this.seen = new Set(data && Array.isArray(data.seen) ? data.seen : []);
  }

  toJSON() {
    return { detected: this.detected, seen: [...this.seen] };
  }

  /**
   * Учесть результат сканирования. Новые копии попадают в detected;
   * исчезнувшие (решённые) забываются — но только у папок, которые просканировались без ошибок.
   */
  recordScan(scan) {
    const okSources = new Set((scan.sources || []).filter((s) => s.ok).map((s) => s.id));
    const current = new Set();
    let added = 0;
    for (const g of scan.groups) {
      for (const c of g.copies) {
        const key = `${g.source.id}::${c.path}`;
        current.add(key);
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        this.detected.unshift({
          t: Date.now(),
          copyTime: c.time.getTime(),
          path: g.path,
          folder: dirname(g.path) || '/',
          device: c.device,
          source: g.source.label,
          kind: g.kind,
        });
        added++;
      }
    }
    for (const key of [...this.seen]) {
      const sid = key.slice(0, key.indexOf('::'));
      if (!current.has(key) && okSources.has(sid)) this.seen.delete(key);
    }
    if (this.detected.length > MAX_DETECTED) this.detected.length = MAX_DETECTED;
    return added;
  }

  clear() {
    this.detected = [];
    this.core.journal.entries = [];
  }

  /**
   * Сводка за период.
   * @param {number|null} days — 7, 30, 90 или null (всё время)
   */
  summary(days) {
    const core = this.core;
    const since = days ? Date.now() - days * DAY : 0;
    const D = this.detected.filter((e) => e.t >= since);
    const J = core.journal.entries.filter((e) => e.t >= since);

    const durations = J.filter((e) => e.copyTime).map((e) => e.t - e.copyTime).filter((x) => x >= 0);
    let autoBlocks = 0;
    let manualBlocks = 0;
    for (const e of J) { autoBlocks += e.auto || 0; manualBlocks += e.manual || 0; }

    // Ряды по дням
    const span = days || Math.min(365, Math.max(7, Math.ceil((Date.now() - Math.min(
      ...D.map((e) => e.t), ...J.map((e) => e.t), Date.now(),
    )) / DAY) + 1));
    const series = [];
    const idx = new Map();
    for (let i = span - 1; i >= 0; i--) {
      const t = Date.now() - i * DAY;
      const k = dayKey(t);
      idx.set(k, series.length);
      series.push({ key: k, date: new Date(t), detected: 0, resolved: 0 });
    }
    for (const e of D) { const i = idx.get(dayKey(e.t)); if (i !== undefined) series[i].detected++; }
    for (const e of J) { const i = idx.get(dayKey(e.t)); if (i !== undefined) series[i].resolved++; }

    const devName = (id) => core.deviceName(id);
    return {
      detected: D.length,
      resolved: J.length,
      open: core.conflictCount(),
      medianMs: median(durations),
      avgMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      autoBlocks,
      manualBlocks,
      autoRate: autoBlocks + manualBlocks ? autoBlocks / (autoBlocks + manualBlocks) : null,
      series,
      byDevice: countBy(D, (e) => devName(e.device)),
      byFolder: countBy(D, (e) => (e.source && e.source !== 'Хранилище' ? `${e.source} › ${e.folder}` : e.folder)),
      topFiles: countBy(D, (e) => e.path).slice(0, 10),
      byKind: countBy(D, (e) => e.kind),
      byAction: countBy(J, (e) => e.action),
      byWeekday: countBy(D, (e) => (new Date(e.t).getDay() + 6) % 7),
    };
  }
}

module.exports = { Stats, formatDuration, dayKey };
