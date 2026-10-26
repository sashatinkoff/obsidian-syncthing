'use strict';
/**
 * Массовый разбор: анализ всех конфликтных копий и пакетные действия по категориям.
 * Рассчитан на десятки тысяч копий: чтение пачками, уступки интерфейсу, отмена, один журнал на всю пачку.
 */

const { TFile } = require('obsidian');
const { classifyText, normalize, CATEGORY_ORDER } = require('../core/classify');
const { pickBase, attachRenamed, isConflictPath } = require('./scanner');
const { sameBuffers, dirname, extOf } = require('../util');

const CATEGORIES = {
  identical: {
    label: 'Идентичные', ico: 'copy-check', tone: 'ok',
    hint: 'Копия совпадает с файлом байт в байт',
    actions: [{ id: 'remove', text: 'Убрать копии', primary: true }],
  },
  whitespace: {
    label: 'Невидимые отличия', ico: 'pilcrow', tone: 'ok',
    hint: 'Только переводы строк, пробелы в концах строк, BOM или форма Юникода (NFC/NFD)',
    actions: [{ id: 'remove', text: 'Оставить текущие', primary: true }],
  },
  'current-newer': {
    label: 'Копия устарела', ico: 'file-check', tone: 'ok',
    hint: 'В текущем файле всё, что есть в копии, плюс новые строки',
    actions: [{ id: 'remove', text: 'Оставить текущие', primary: true }],
  },
  'copy-newer': {
    label: 'Копия новее', ico: 'file-input', tone: 'info',
    hint: 'В копии всё, что есть в текущем файле, плюс новые строки',
    actions: [{ id: 'take', text: 'Взять копии', primary: true }, { id: 'remove', text: 'Оставить текущие' }],
  },
  props: {
    label: 'Только свойства', ico: 'list', tone: 'info',
    hint: 'Текст одинаковый, отличаются свойства (frontmatter)',
    actions: [{ id: 'remove', text: 'Оставить текущие свойства', primary: true }, { id: 'take', text: 'Взять свойства копий' }],
  },
  auto: {
    label: 'Сливаются сами', ico: 'sparkles', tone: 'info',
    hint: 'Правки в разных местах — трёхстороннее слияние с базой из .stversions без конфликтов',
    actions: [{ id: 'merge', text: 'Слить', primary: true }],
  },
  missing: {
    label: 'Нет исходного файла', ico: 'file-x', tone: 'warn',
    hint: 'Файл удалили, а копия осталась; переименованного файла с таким же содержимым не нашлось',
    actions: [{ id: 'restore', text: 'Восстановить из копий' }, { id: 'remove', text: 'Удалить копии' }],
  },
  binary: {
    label: 'Разные медиа и файлы', ico: 'image', tone: 'warn',
    hint: 'Картинки и другие двоичные файлы отличаются',
    actions: [{ id: 'remove', text: 'Оставить текущие' }, { id: 'take', text: 'Взять копии' }, { id: 'both', text: 'Оставить обе' }],
  },
  conflict: {
    label: 'Настоящие конфликты', ico: 'git-merge', tone: 'conflict',
    hint: 'Встречные правки в одних и тех же местах — нужна сверка',
    actions: [{ id: 'both', text: 'Оставить обе версии' }, { id: 'remove', text: 'Оставить текущие' }],
  },
};

const ACTION_VERB = {
  remove: 'Убрано копий',
  take: 'Взято копий',
  merge: 'Слито',
  restore: 'Восстановлено',
  both: 'Сохранено рядом',
};

const tick = () => new Promise((r) => setTimeout(r, 0));

class Bulk {
  constructor(core) {
    this.core = core;
    this.state = null; // { kind: 'analyze'|'run', done, total, started, label, cancel }
  }

  get running() { return !!this.state; }

  cancel() { if (this.state) this.state.cancelled = true; }

  progress(done, st) {
    const s = st || this.state;
    if (!s || s !== this.state) return;
    s.done = done;
    const now = Date.now();
    if (now - (s.lastEmit || 0) > 200 || done === s.total) {
      s.lastEmit = now;
      this.core.emitProgress();
    }
  }

  /* ---------- анализ ---------- */

  /** Классифицирует все копии текущего скана. Результат — в copy.category / copy.detail. */
  async analyze(scan) {
    const items = [];
    for (const g of scan.groups) for (const c of g.copies) items.push([g, c]);
    scan.analysis = { done: false, total: items.length, counts: {} };
    if (!items.length) { scan.analysis.done = true; return scan.analysis; }
    if (this.state && this.state.kind === 'run') return scan.analysis; // идёт массовое действие — пересчитаем после него

    // Предыдущий анализ (старого скана) останавливаем — у каждого своё состояние
    if (this.state) this.state.cancelled = true;
    const st = { kind: 'analyze', label: 'Анализ копий', done: 0, total: items.length, started: Date.now() };
    this.state = st;
    this.core.emitProgress();

    this.sizeIndex = null; // для поиска переименованных файлов по содержимому — строится по требованию
    const cache = new Map(); // текущий файл группы — читаем один раз
    const readCurrent = async (g) => {
      if (!g.exists) return null;
      if (cache.has(g.id)) return cache.get(g.id);
      const p = g.kind === 'text' ? g.source.read(g.path) : g.source.readBinary(g.path);
      cache.set(g.id, p);
      return p;
    };

    let done = 0;
    const BATCH = 16;
    try {
      for (let i = 0; i < items.length; i += BATCH) {
        if (st.cancelled || this.core.scan !== scan) break;
        const batch = items.slice(i, i + BATCH);
        await Promise.all(batch.map(async ([g, c]) => {
          try {
            await this.classify(g, c, readCurrent);
          } catch (e) {
            c.category = 'conflict';
            c.detail = `не удалось прочитать: ${e.message}`;
          }
          c.identical = c.category === 'identical';
        }));
        // Группа разобрана целиком — освобождаем память
        for (const [g] of batch) if (g.copies.every((c) => c.category)) cache.delete(g.id);
        done += batch.length;
        this.progress(done, st);
        await tick();
      }
    } finally {
      const counts = {};
      for (const [, c] of items) if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
      scan.analysis = { done: done === items.length, total: items.length, analyzed: done, counts, ms: Date.now() - st.started };
      if (this.state === st) {
        this.state = null;
        this.core.emit();
      }
    }
    return scan.analysis;
  }

  async classify(g, c, readCurrent) {
    const src = g.source;
    if (!g.exists && g.kind === 'text') {
      // Один поиск на файл: остальные копии этого файла ждут его результат
      if (!g.renameSearch) {
        g.renameSearch = (async () => {
          const target = await this.findByContent(g, c);
          if (target && !g.exists) await attachRenamed(g, target, 'content');
        })();
      }
      await g.renameSearch;
    }
    if (!g.exists) { c.category = 'missing'; c.detail = null; return; }

    if (g.kind !== 'text') {
      const [a, b] = await Promise.all([readCurrent(g), src.readBinary(c.path)]);
      c.category = sameBuffers(a, b) ? 'identical' : 'binary';
      c.detail = null;
      return;
    }

    const [cur, copy] = await Promise.all([readCurrent(g), src.read(c.path)]);
    let base = null;
    if (cur !== copy && this.core.settings.autoBase !== false) {
      const ver = pickBase(g, c);
      if (ver) { try { base = await ver.source.read(ver.path); } catch (e) { base = null; } }
    }
    const r = classifyText({ current: cur, copy, base, mergeProperties: this.core.settings.mergeProperties });
    // Файл с похожим именем в другой папке, но с совсем другим текстом — это не наш файл
    if (g.renamedFrom && g.renamedHow === 'name' && r.category === 'conflict' && dirname(g.renamedFrom) !== dirname(g.path)) {
      this.detachRenamed(g);
      c.category = 'missing';
      c.detail = null;
      return;
    }
    c.category = r.category;
    c.detail = r.detail || null;
    c.hasBase = base !== null;
    if (g.renamedFrom) c.detail = `переименован → ${g.name}${c.detail ? ` · ${c.detail}` : ''}`;
  }

  detachRenamed(g) {
    g.path = g.renamedFrom;
    g.name = g.renamedFrom.split('/').pop();
    g.renamedFrom = null;
    g.renamedHow = null;
    g.exists = false;
    g.size = null;
    g.mtime = null;
  }

  /** Переименованный файл с тем же содержимым: ищем среди файлов того же типа и почти того же размера. */
  async findByContent(g, c) {
    if (g.source.kind !== 'vault' || c.size === null || c.size === undefined) return null;
    if (!this.sizeIndex) {
      this.sizeIndex = new Map();
      for (const f of this.core.app.vault.getFiles()) {
        if (!(f instanceof TFile) || isConflictPath(f.path) || !f.stat) continue;
        const k = `${f.extension.toLowerCase()}:${f.stat.size}`;
        if (!this.sizeIndex.has(k)) this.sizeIndex.set(k, []);
        this.sizeIndex.get(k).push(f.path);
      }
    }
    const ext = extOf(g.path);
    const cand = [];
    for (let d = -16; d <= 16 && cand.length < 12; d++) {
      const list = this.sizeIndex.get(`${ext}:${c.size + d}`);
      if (list) for (const p of list) if (cand.length < 12) cand.push(p);
    }
    if (!cand.length) return null;
    const copy = normalize(await g.source.read(c.path));
    const dir = dirname(g.path);
    cand.sort((a, b) => (dirname(b) === dir) - (dirname(a) === dir));
    for (const p of cand) {
      try { if (normalize(await g.source.read(p)) === copy) return p; } catch (e) { /* пропускаем */ }
    }
    return null;
  }

  /* ---------- пакетные действия ---------- */

  /** Пары [группа, копия] категории. */
  items(category) {
    const scan = this.core.scan;
    if (!scan) return [];
    const out = [];
    for (const g of scan.groups) for (const c of g.copies) if (c.category === category) out.push([g, c]);
    return out;
  }

  /**
   * Выполнить действие над всеми копиями категории.
   * @returns {Promise<{ok:number, failed:number, skipped:number, errors:string[], cancelled:boolean}>}
   */
  async run(category, action) {
    const items = this.items(category);
    const res = { ok: 0, failed: 0, skipped: 0, errors: [], cancelled: false };
    if (!items.length) return res;
    const meta = CATEGORIES[category];
    const mode = this.core.settings.removeMode;

    if (this.state) this.state.cancelled = true; // останавливаем идущий анализ
    const st = { kind: 'run', label: `${meta.label}: ${ACTION_VERB[action].toLowerCase()}`, done: 0, total: items.length, started: Date.now() };
    this.state = st;
    this.core.emitProgress();

    // Для действий, меняющих сам файл, у группы берём одну (самую свежую) копию — остальные пересчитаются
    const changesFile = action === 'take' || action === 'merge' || action === 'restore';
    const touched = new Set();

    try {
      for (let i = 0; i < items.length; i++) {
        if (st.cancelled) { res.cancelled = true; break; }
        const [g, c] = items[i];
        try {
          if (changesFile && touched.has(g.id)) { res.skipped++; continue; }
          await this.apply(g, c, action, mode);
          if (changesFile) touched.add(g.id);
          res.ok++;
        } catch (e) {
          res.failed++;
          if (res.errors.length < 20) res.errors.push(`${g.path}: ${e.message}`);
        }
        this.progress(i + 1, st);
        if (i % 20 === 19) await tick();
      }
    } finally {
      if (this.state === st) this.state = null;
      if (res.ok) {
        this.core.journal.add({
          t: Date.now(),
          bulk: true,
          n: res.ok,
          category,
          action: action === 'remove' ? 'keep' : action === 'restore' ? 'take' : action,
          path: `Массовый разбор · ${meta.label} · ${res.ok}`,
          source: 'Хранилище',
          device: null,
        });
      }
      this.core.emit();
    }
    return res;
  }

  async apply(g, c, action, mode) {
    const src = g.source;
    const a = this.core.actions;
    switch (action) {
      case 'remove':
        await src.remove(c.path, mode);
        return;
      case 'take':
        await a.takeCopy(g, c, { log: false });
        return;
      case 'restore':
        if (await src.exists(g.path)) throw new Error('файл уже существует');
        await src.rename(c.path, g.path);
        return;
      case 'both':
        await a.keepBoth(g, c, { log: false });
        return;
      case 'merge': {
        const [cur, copy] = await Promise.all([src.read(g.path), src.read(c.path)]);
        const ver = pickBase(g, c);
        const base = ver ? await ver.source.read(ver.path) : null;
        const r = classifyText({ current: cur, copy, base, mergeProperties: this.core.settings.mergeProperties });
        if (r.category !== 'auto' || r.merged === null || r.merged === undefined) throw new Error('файл изменился, слить автоматически нельзя');
        await src.write(g.path, r.merged);
        await src.remove(c.path, mode);
        return;
      }
      default:
        throw new Error(`неизвестное действие ${action}`);
    }
  }
}

module.exports = { Bulk, CATEGORIES, CATEGORY_ORDER, ACTION_VERB };
