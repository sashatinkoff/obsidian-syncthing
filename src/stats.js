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
const MASS_THRESHOLD = 200; // больше новых копий за один скан — пишем сводными записями

/** Короткий хэш ключа копии (FNV-1a), чтобы список «уже видели» не раздувал data.json. */
function hashKey(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function countBy(list, keyFn) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (k === null || k === undefined) continue;
    m.set(k, (m.get(k) || 0) + (x.n || 1));
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
    const allOk = (scan.sources || []).every((s) => s.ok);
    const current = new Set();
    const fresh = [];
    for (const g of scan.groups) {
      for (const c of g.copies) {
        const key = hashKey(`${g.source.id}::${c.path}`);
        current.add(key);
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        fresh.push({
          t: Date.now(),
          copyTime: c.time.getTime(),
          path: g.path,
          folder: dirname(g.path) || '/',
          device: c.device,
          source: g.source.label,
          kind: g.kind,
        });
      }
    }

    if (fresh.length > MASS_THRESHOLD) {
      // Массовый наплыв: одна запись на (устройство, папка, тип) с количеством
      const agg = new Map();
      for (const e of fresh) {
        const k = `${e.device}|${e.source}|${e.folder}|${e.kind}`;
        const a = agg.get(k);
        if (a) { a.n++; a.copyTime = Math.min(a.copyTime, e.copyTime); } else agg.set(k, { ...e, path: null, n: 1, mass: true });
      }
      this.detected.unshift(...agg.values());
    } else {
      this.detected.unshift(...fresh);
    }

    // Решённые копии забываем, только если все папки просканировались без ошибок
    if (allOk) for (const key of [...this.seen]) if (!current.has(key)) this.seen.delete(key);
    if (this.detected.length > MAX_DETECTED) this.detected.length = MAX_DETECTED;
    return fresh.length;
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
    for (const e of D) { const i = idx.get(dayKey(e.t)); if (i !== undefined) series[i].detected += e.n || 1; }
    for (const e of J) { const i = idx.get(dayKey(e.t)); if (i !== undefined) series[i].resolved += e.n || 1; }

    const devName = (id) => core.deviceName(id);
    return {
      detected: D.reduce((n, e) => n + (e.n || 1), 0),
      resolved: J.reduce((n, e) => n + (e.n || 1), 0),
      open: core.conflictCount(),
      medianMs: median(durations),
      avgMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      autoBlocks,
      manualBlocks,
      autoRate: autoBlocks + manualBlocks ? autoBlocks / (autoBlocks + manualBlocks) : null,
      series,
      byDevice: countBy(D, (e) => devName(e.device)),
      byFolder: countBy(D, (e) => (e.source && e.source !== 'Хранилище' ? `${e.source} › ${e.folder}` : e.folder)),
      topFiles: countBy(D.filter((e) => e.path), (e) => e.path).slice(0, 10),
      byKind: countBy(D, (e) => e.kind),
      byAction: countBy(J, (e) => e.action),
      byWeekday: countBy(D, (e) => (new Date(e.t).getDay() + 6) % 7),
    };
  }
}

module.exports = { Stats, formatDuration, dayKey };
