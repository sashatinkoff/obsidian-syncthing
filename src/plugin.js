'use strict';
/**
 * Ядро плагина: настройки, сканирование, команды, события.
 * main.js лишь загружает модули из src/ и передаёт сюда экземпляр Plugin (host).
 */

const { Notice, Platform, TFile, TFolder, Menu, debounce, normalizePath } = require('obsidian');
const { VIEW_TYPE, ICON, DEFAULT_SETTINGS } = require('./constants');
const { VaultSource, createFolderSource } = require('./io/sources');
const { scanAll, scanSource, checkIdentical, isConflictPath, parseConflict } = require('./io/scanner');
const { ConflictActions } = require('./io/actions');
const { Journal, ACTION_LABELS } = require('./journal');
const { Stats, formatDuration } = require('./stats');
const { ConflictView } = require('./ui/view');
const { SettingsTab } = require('./settings');
const { confirm } = require('./ui/dom');
const { plural, formatDate } = require('./util');

class Core {
  constructor(host) {
    this.host = host;
    this.app = host.app;
    this.manifest = host.manifest;
    this.listeners = new Set();
    this.scan = null;
    this.scanning = false;
    this.pendingScan = false;
    this.knownCopies = null;
  }

  async onload() {
    const data = (await this.host.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    this.settings.deviceNames = Object.assign({}, this.settings.deviceNames);
    this.settings.excludedFolders = [...(this.settings.excludedFolders || [])];
    this.settings.externalFolders = [...(this.settings.externalFolders || [])];
    this.journal = new Journal(this, data.journal);
    this.stats = new Stats(this, data.stats);
    this.actions = new ConflictActions(this);
    this.vaultSource = new VaultSource(this);

    const host = this.host;
    host.registerView(VIEW_TYPE, (leaf) => new ConflictView(leaf, this));
    this.ribbonEl = host.addRibbonIcon(ICON, 'Конфликты Syncthing', () => this.openView());
    this.ribbonEl.addClass('scr-ribbon');
    this.ribbonEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.ribbonMenu().showAtMouseEvent(e);
    });

    this.statusEl = host.addStatusBarItem();
    this.statusEl.addClass('scr-status', 'mod-clickable');
    this.statusEl.addEventListener('click', () => this.openView());
    this.updateStatus();

    host.addCommand({ id: 'open', name: 'Открыть конфликты', callback: () => this.openView() });
    host.addCommand({ id: 'rescan', name: 'Проверить конфликты заново', callback: () => this.rescan({ notifyEmpty: true }) });
    host.addCommand({ id: 'open-stats', name: 'Статистика конфликтов', callback: () => this.openView(null, 'stats') });
    host.addCommand({ id: 'check-folders', name: 'Проверить папки на устройстве', callback: () => this.checkAllFolders() });
    host.addCommand({ id: 'stats-note', name: 'Сохранить отчёт статистики в заметку', callback: () => this.writeStatsNote() });
    host.addCommand({ id: 'clean-identical', name: 'Убрать идентичные конфликтные копии', callback: () => this.cleanIdentical(true) });
    host.addCommand({
      id: 'resolve-active',
      name: 'Сверить конфликт текущего файла',
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        const hit = this.findForPath(f.path);
        if (!hit) return false;
        if (!checking) this.openView(hit);
        return true;
      },
    });

    host.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile)) return;
      const hit = this.findForPath(file.path);
      if (!hit) return;
      menu.addItem((i) => i.setTitle('Сверить конфликт Syncthing').setIcon(ICON).onClick(() => this.openView(hit)));
    }));

    this.queueScan = debounce(() => this.rescan({ notify: true }), 1500, true);
    const onChange = (file, oldPath) => {
      if (!this.settings.autoScan) return;
      if (isConflictPath(file.path) || (oldPath && isConflictPath(oldPath))) this.queueScan();
    };
    host.registerEvent(this.app.vault.on('create', (f) => onChange(f)));
    host.registerEvent(this.app.vault.on('delete', (f) => onChange(f)));
    host.registerEvent(this.app.vault.on('rename', (f, old) => onChange(f, old)));

    host.addSettingTab(new SettingsTab(this));

    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => this.rescan({ notify: true }), 2500);
    });
  }

  onunload() {
    this.listeners.clear();
  }

  /* ---------- данные ---------- */

  async saveData_() {
    await this.host.saveData({ settings: this.settings, journal: this.journal.entries, stats: this.stats.toJSON() });
  }

  async saveSettings() { await this.saveData_(); }

  async readReadme() {
    const p = `${this.manifest.dir}/README.md`;
    try {
      if (await this.app.vault.adapter.exists(p)) {
        const md = await this.app.vault.adapter.read(p);
        // Картинки README лежат в папке плагина — подставляем полный путь, чтобы они показались в настройках
        const adapter = this.app.vault.adapter;
        return md.replace(/!\[([^\]]*)\]\((screenshots\/[^)\s]+)\)/g, (m, alt, rel) => {
          try { return `![${alt}](${adapter.getResourcePath(`${this.manifest.dir}/${rel}`)})`; } catch (e) { return m; }
        });
      }
    } catch (e) { /* нет файла */ }
    // README не скопирован (установщик переносит только main.js, manifest.json, styles.css) —
    // берём текст, встроенный в main.js при сборке, без картинок
    const embedded = typeof globalThis.__SCR_README === 'string' ? globalThis.__SCR_README : null;
    if (embedded) return embedded.replace(/^!\[[^\]]*\]\(screenshots\/[^)]+\)\s*$/gm, '');
    return null;
  }

  deviceName(id) { return (this.settings.deviceNames && this.settings.deviceNames[id]) || id; }

  /** ID этого устройства: хранится локально и не синхронизируется. */
  localDeviceId() {
    if (this._deviceId) return this._deviceId;
    const KEY = 'scr-device-id';
    const load = () => (this.app.loadLocalStorage ? this.app.loadLocalStorage(KEY) : window.localStorage.getItem(KEY));
    let id = null;
    try { id = load(); } catch (e) { id = null; }
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      try {
        if (this.app.saveLocalStorage) this.app.saveLocalStorage(KEY, id);
        else window.localStorage.setItem(KEY, id);
      } catch (e) { /* без localStorage живём с временным ID */ }
    }
    this._deviceId = id;
    return id;
  }

  /** Папки, настроенные именно на этом устройстве. */
  foldersHere() {
    const me = this.localDeviceId();
    // Папки из прошлой версии (без привязки) были только десктопными
    return this.settings.externalFolders.filter((f) => f && f.path && (f.deviceId ? f.deviceId === me : Platform.isDesktopApp));
  }

  getSources() {
    const list = [this.vaultSource];
    for (const f of this.foldersHere()) {
      if (f.enabled === false) continue;
      const src = createFolderSource(this.app, f);
      if (src) list.push(src);
    }
    return list;
  }

  /** Проверить одну папку: доступ и число конфликтов (без изменения общего списка). */
  async checkFolder(folder) {
    const src = createFolderSource(this.app, folder);
    if (!src) return { ok: false, error: 'На этом устройстве папки вне хранилища недоступны' };
    const r = await scanSource(this, src);
    return r.status;
  }

  async checkAllFolders() {
    await this.rescan();
    if (!this.scan) return;
    const lines = this.scan.sources.map((s) => (s.ok
      ? `${s.label}: ${s.conflicts ? `${s.conflicts} ${plural(s.conflicts, 'конфликт', 'конфликта', 'конфликтов')}` : 'чисто'}`
      : `${s.label}: ${s.error}`));
    new Notice(`Проверка папок\n${lines.join('\n')}`, 8000);
  }

  ribbonMenu() {
    const m = new Menu();
    const n = this.conflictCount();
    m.addItem((i) => i.setTitle(n ? `Открыть конфликты (${n})` : 'Открыть конфликты').setIcon(ICON).onClick(() => this.openView()));
    m.addItem((i) => i.setTitle('Проверить сейчас').setIcon('refresh-cw').onClick(() => this.rescan({ notifyEmpty: true })));
    m.addItem((i) => i.setTitle('Проверить папки на устройстве').setIcon('folder-search').onClick(() => this.checkAllFolders()));
    m.addSeparator();
    m.addItem((i) => i.setTitle('Статистика').setIcon('bar-chart-3').onClick(() => this.openView(null, 'stats')));
    m.addItem((i) => i.setTitle('Журнал').setIcon('history').onClick(() => this.openView(null, 'journal')));
    m.addItem((i) => i.setTitle('Убрать идентичные копии').setIcon('copy-check').onClick(() => this.cleanIdentical(true)));
    return m;
  }

  /** Отчёт статистики в markdown-заметку. */
  async writeStatsNote() {
    const path = normalizePath(this.settings.statsNotePath || 'Syncthing/Статистика конфликтов.md');
    const all = this.stats.summary(null);
    const month = this.stats.summary(30);
    const row = (cells) => `| ${cells.join(' | ')} |`;
    const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
    const kinds = { text: 'Текст', image: 'Картинки', binary: 'Другие файлы' };
    const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);
    const md = [
      '---',
      `updated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      'tags:',
      '  - syncthing',
      '---',
      '# Статистика конфликтов Syncthing',
      '',
      `Обновлено: ${formatDate(Date.now())}`,
      '',
      table(['Показатель', 'За 30 дней', 'За всё время'], [
        ['Обнаружено конфликтов', month.detected, all.detected],
        ['Решено', month.resolved, all.resolved],
        ['Открыто сейчас', all.open, all.open],
        ['Медиана до решения', formatDuration(month.medianMs), formatDuration(all.medianMs)],
        ['Доля автослияния блоков', pct(month.autoRate), pct(all.autoRate)],
      ]),
      '',
      '## Устройства',
      '',
      all.byDevice.length ? table(['Устройство', 'Конфликтов'], all.byDevice) : '_нет данных_',
      '',
      '## Папки',
      '',
      all.byFolder.length ? table(['Папка', 'Конфликтов'], all.byFolder.slice(0, 15)) : '_нет данных_',
      '',
      '## Самые конфликтные файлы',
      '',
      all.topFiles.length ? table(['Файл', 'Конфликтов'], all.topFiles.map(([p, n]) => [`[[${p.replace(/\.md$/, '')}]]`, n])) : '_нет данных_',
      '',
      '## Как решались',
      '',
      all.byAction.length ? table(['Способ', 'Раз'], all.byAction.map(([a, n]) => [ACTION_LABELS[a] || a, n])) : '_нет данных_',
      '',
      '## Типы файлов',
      '',
      all.byKind.length ? table(['Тип', 'Конфликтов'], all.byKind.map(([k, n]) => [kinds[k] || k, n])) : '_нет данных_',
      '',
    ].join('\n');

    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    if (dir && !(this.app.vault.getAbstractFileByPath(dir) instanceof TFolder)) {
      try { await this.app.vault.createFolder(dir); } catch (e) { /* папка уже есть */ }
    }
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, md);
    else await this.app.vault.create(path, md);
    new Notice(`Отчёт сохранён: ${path}`);
    await this.app.workspace.openLinkText(path, '', 'tab');
  }

  /* ---------- сканирование ---------- */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.updateStatus();
    for (const fn of this.listeners) {
      try { fn(); } catch (e) { console.error('[Syncthing Conflict Resolver]', e); }
    }
  }

  conflictCount() {
    return this.scan ? this.scan.groups.reduce((n, g) => n + g.copies.length, 0) : 0;
  }

  updateStatus() {
    const n = this.conflictCount();
    if (this.ribbonEl) {
      this.ribbonEl.dataset.count = String(n);
      this.ribbonEl.setAttr('aria-label', n ? `Конфликты Syncthing: ${n}` : 'Конфликты Syncthing');
    }
    if (!this.statusEl) return;
    this.statusEl.empty();
    this.statusEl.toggleClass('is-hidden', n === 0);
    if (n) {
      this.statusEl.setText(`⇄ ${n} ${plural(n, 'конфликт', 'конфликта', 'конфликтов')}`);
      this.statusEl.setAttr('aria-label', 'Открыть конфликты Syncthing');
    }
  }

  async rescan(opts = {}) {
    if (this.scanning) { this.pendingScan = true; return; }
    this.scanning = true;
    this.emit();
    try {
      const result = await scanAll(this);
      this.scan = result;
      if (this.stats.recordScan(result)) await this.saveData_();
      this.scanning = false;
      this.emit();

      for (const g of result.groups) {
        for (const c of g.copies) {
          if (this.scan !== result) return;
          await checkIdentical(g, c);
        }
      }
      if (this.scan === result) this.emit();

      const keys = new Set(result.groups.flatMap((g) => g.copies.map((c) => `${g.source.id}::${c.path}`)));
      if (opts.notify && this.settings.notifyNew && this.knownCopies) {
        const fresh = [...keys].filter((k) => !this.knownCopies.has(k)).length;
        if (fresh) this.notice(`Syncthing: ${fresh} ${plural(fresh, 'новый конфликт', 'новых конфликта', 'новых конфликтов')}. Нажмите, чтобы разобрать.`);
      } else if (opts.notify && this.settings.notifyNew && !this.knownCopies && keys.size) {
        this.notice(`Syncthing: ${keys.size} ${plural(keys.size, 'конфликт ждёт', 'конфликта ждут', 'конфликтов ждут')} решения.`);
      }
      if (opts.notifyEmpty && !keys.size) new Notice('Конфликтов нет');
      this.knownCopies = keys;
    } catch (e) {
      console.error('[Syncthing Conflict Resolver]', e);
      new Notice(`Ошибка проверки: ${e.message}`);
    } finally {
      this.scanning = false;
      if (this.pendingScan) {
        this.pendingScan = false;
        this.rescan(opts);
      } else {
        this.emit();
      }
    }
  }

  notice(text) {
    const n = new Notice(text, 10000);
    const el = n.noticeEl || n.containerEl || n.messageEl;
    if (el) el.addEventListener('click', () => this.openView());
  }

  /** Конфликт для файла: сам исходный файл или его конфликтная копия. */
  findForPath(path) {
    if (!this.scan) return null;
    const parsed = parseConflict(path);
    for (const g of this.scan.groups) {
      if (g.source.kind !== 'vault') continue;
      if (g.path === path) return { group: g, copy: g.copies[0] };
      if (parsed && g.path === parsed.original) {
        const c = g.copies.find((x) => x.path === path);
        if (c) return { group: g, copy: c };
      }
    }
    return null;
  }

  async cleanIdentical(ask) {
    if (!this.scan) await this.rescan();
    if (!this.scan) return 0;
    const pairs = [];
    for (const g of this.scan.groups) for (const c of g.copies) {
      if (c.identical === null) await checkIdentical(g, c);
      if (c.identical) pairs.push([g, c]);
    }
    if (!pairs.length) { new Notice('Идентичных копий нет'); return 0; }
    if (ask) {
      const ok = await confirm(this.app, {
        title: 'Убрать идентичные копии?',
        text: `${pairs.length} ${plural(pairs.length, 'копия совпадает', 'копии совпадают', 'копий совпадают')} с текущими файлами байт в байт.`,
        confirm: 'Убрать',
      });
      if (!ok) return null;
    }
    let n = 0;
    for (const [g, c] of pairs) {
      try { await this.actions.removeIdentical(g, c); n++; } catch (e) { new Notice(`${g.name}: ${e.message}`); }
    }
    new Notice(`Убрано идентичных копий: ${n}`);
    await this.rescan();
    return n;
  }

  /* ---------- окно ---------- */

  async openView(hit, tab) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    ws.revealLeaf(leaf);
    const view = leaf.view;
    if (hit && view && view.openMerge) await view.openMerge(hit.group, hit.copy);
    else if (tab && view && view.setTab) view.setTab(tab);
    return view;
  }
}

module.exports = { Core };
