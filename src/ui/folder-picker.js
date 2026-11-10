'use strict';
/**
 * Выбор папки вне хранилища.
 *   Компьютер — системный диалог (Finder / Проводник).
 *   Android   — встроенный обозреватель папок: системный выбор папки плагинам Obsidian недоступен.
 *   Любая платформа — выбор из списка папок Syncthing (REST API).
 */

const { Modal, Platform, Notice } = require('obsidian');
const { button, icon } = require('./dom');
const { fetchFolders } = require('../io/syncthing-api');

const ANDROID_ROOT = '/storage/emulated/0';

/* ---------- компьютер: системный диалог ---------- */

async function pickDesktop(title) {
  try {
    const electron = require('electron');
    let remote = electron.remote;
    if (!remote) { try { remote = require('@electron/remote'); } catch (e) { remote = null; } }
    if (remote && remote.dialog) {
      const win = remote.getCurrentWindow ? remote.getCurrentWindow() : undefined;
      const r = await remote.dialog.showOpenDialog(win, {
        title: title || 'Выберите папку Syncthing',
        buttonLabel: 'Выбрать папку',
        properties: ['openDirectory', 'createDirectory', 'showHiddenFiles'],
      });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
      return r.filePaths[0];
    }
  } catch (e) { /* переходим к запасному варианту */ }

  // Запасной вариант: выбор папки браузерным диалогом (тоже системный)
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) { resolve(null); return; }
      let p = f.path;
      try {
        const { webUtils } = require('electron');
        if (!p && webUtils) p = webUtils.getPathForFile(f);
      } catch (e) { /* ignore */ }
      if (!p) { resolve(null); return; }
      const nodePath = require('path');
      const depth = (f.webkitRelativePath || '').split('/').length - 1;
      let dir = p;
      for (let i = 0; i < depth; i++) dir = nodePath.dirname(dir);
      resolve(dir);
    });
    input.click();
  });
}

/* ---------- Android: обозреватель папок ---------- */

function fsApi(app) {
  const cap = window.Capacitor;
  return (cap && cap.Plugins && cap.Plugins.Filesystem) || (app && app.vault.adapter && app.vault.adapter.fs) || null;
}

const toUri = (p) => `file://${p.startsWith('/') ? '' : '/'}${p.split('/').map((s, i) => (i ? encodeURIComponent(s) : s)).join('/')}`;

class FolderBrowserModal extends Modal {
  constructor(app, opts, resolve) {
    super(app);
    this.opts = opts || {};
    this.resolve = resolve;
    this.result = null;
    this.path = this.opts.start || ANDROID_ROOT;
    this.fs = fsApi(app);
  }

  onOpen() {
    this.modalEl.addClass('scr-modal', 'scr-picker');
    this.titleEl.setText(this.opts.title || 'Выберите папку');
    this.render();
  }

  async list(path) {
    const r = await this.fs.readdir({ path: toUri(path) });
    const out = [];
    for (const f of r.files || []) {
      if (typeof f === 'string') {
        try {
          const st = await this.fs.stat({ path: toUri(`${path}/${f}`) });
          if (st.type === 'directory') out.push(f);
        } catch (e) { /* пропускаем */ }
      } else if (f.type === 'directory') out.push(f.name);
    }
    return out.sort((a, b) => a.localeCompare(b, 'ru'));
  }

  async exists(path) {
    try { await this.fs.stat({ path: toUri(path) }); return true; } catch (e) { return false; }
  }

  async render() {
    const el = this.contentEl;
    el.empty();

    // Быстрые переходы
    const quick = el.createDiv('scr-picker-quick');
    const places = [
      ['smartphone', 'Память телефона', ANDROID_ROOT],
      ['folder', 'Syncthing', `${ANDROID_ROOT}/Syncthing`],
      ['folder', 'Documents', `${ANDROID_ROOT}/Documents`],
      ['folder', 'Download', `${ANDROID_ROOT}/Download`],
    ];
    for (const [ico, label, p] of places) {
      if (p !== ANDROID_ROOT && !(await this.exists(p))) continue;
      button(quick, { text: label, icon: ico, variant: this.path === p ? 'soft' : 'ghost', onClick: () => { this.path = p; this.render(); } });
    }

    // Путь крошками
    const crumbs = el.createDiv('scr-picker-crumbs');
    const rel = this.path.startsWith(ANDROID_ROOT) ? this.path.slice(ANDROID_ROOT.length) : this.path;
    const parts = rel.split('/').filter(Boolean);
    const rootBtn = crumbs.createEl('button', { cls: 'scr-crumb', text: this.path.startsWith(ANDROID_ROOT) ? 'Память' : '/' });
    rootBtn.addEventListener('click', () => { this.path = this.path.startsWith(ANDROID_ROOT) ? ANDROID_ROOT : '/'; this.render(); });
    let acc = this.path.startsWith(ANDROID_ROOT) ? ANDROID_ROOT : '';
    for (const part of parts) {
      acc += `/${part}`;
      crumbs.createSpan({ cls: 'scr-crumb-sep', text: '›' });
      const target = acc;
      const b = crumbs.createEl('button', { cls: 'scr-crumb', text: part });
      b.addEventListener('click', () => { this.path = target; this.render(); });
    }

    const listEl = el.createDiv('scr-picker-list');
    listEl.createDiv({ cls: 'scr-muted scr-pad', text: 'Загружаю…' });

    const foot = el.createDiv('scr-modal-actions scr-picker-foot');
    foot.createDiv({ cls: 'scr-picker-current', text: this.path });
    button(foot, { text: 'Отмена', onClick: () => this.close() });
    button(foot, {
      text: 'Выбрать эту папку', icon: 'check', variant: 'primary',
      onClick: () => { this.result = this.path; this.close(); },
    });

    let dirs;
    try {
      dirs = await this.list(this.path);
    } catch (e) {
      listEl.empty();
      const b = listEl.createDiv('scr-banner scr-banner-error');
      icon(b, 'alert-triangle');
      b.createSpan({ text: /permission|denied|EACCES/i.test(String(e && e.message)) ? 'Нет доступа к этой папке. Разрешите Obsidian доступ ко всем файлам: Настройки Android → Приложения → Obsidian → Разрешения.' : `Не удалось открыть папку: ${e.message || e}` });
      return;
    }
    listEl.empty();
    if (this.path !== ANDROID_ROOT && this.path !== '/') {
      const up = listEl.createDiv('scr-picker-row is-up');
      icon(up, 'arrow-left');
      up.createSpan({ text: 'Наверх' });
      up.addEventListener('click', () => { this.path = this.path.replace(/\/[^/]+$/, '') || '/'; this.render(); });
    }
    if (!dirs.length) listEl.createDiv({ cls: 'scr-muted scr-pad', text: 'Вложенных папок нет' });
    for (const d of dirs) {
      if (d.startsWith('.') && d !== '.stversions') continue;
      const row = listEl.createDiv('scr-picker-row');
      icon(row, 'folder');
      row.createSpan({ text: d });
      row.addEventListener('click', () => { this.path = `${this.path === '/' ? '' : this.path}/${d}`; this.render(); });
    }
  }

  onClose() { this.resolve(this.result); }
}

/* ---------- папки из Syncthing ---------- */

class SyncthingFoldersModal extends Modal {
  constructor(app, { folders, added, vaultPath }, resolve) {
    super(app);
    this.folders = folders;
    this.added = added;
    this.vaultPath = vaultPath;
    this.vaultName = app.vault.getName ? app.vault.getName() : null;
    this.resolve = resolve;
    this.result = null;
  }

  onOpen() {
    this.modalEl.addClass('scr-modal', 'scr-picker');
    this.titleEl.setText('Папки Syncthing на этом устройстве');
    const list = this.contentEl.createDiv('scr-picker-list');
    const norm = (p) => expandHome(p || '').replace(/[\\/]+$/, '');
    for (const f of this.folders) {
      const row = list.createDiv('scr-picker-row scr-picker-st');
      icon(row, 'folder');
      const body = row.createDiv('scr-picker-st-body');
      body.createDiv({ cls: 'scr-picker-st-name', text: f.label || f.id });
      body.createDiv({ cls: 'scr-picker-st-path', text: f.path });
      // Полный путь хранилища на телефоне известен не всегда — тогда сверяем по имени папки
      const isVault = this.vaultPath
        ? norm(f.path) === norm(this.vaultPath)
        : !!this.vaultName && norm(f.path).split(/[\\/]/).pop() === this.vaultName;
      const isAdded = this.added.has(norm(f.path));
      if (isVault || isAdded) {
        row.addClass('is-disabled');
        row.createSpan({ cls: 'scr-chip scr-chip-muted', text: isVault ? 'это хранилище' : 'уже добавлена' });
        continue;
      }
      if (f.versioning) row.createSpan({ cls: 'scr-chip scr-chip-ok', text: 'есть версии' });
      row.addEventListener('click', () => { this.result = f; this.close(); });
    }
    if (!this.folders.length) list.createDiv({ cls: 'scr-muted scr-pad', text: 'Syncthing не вернул ни одной папки.' });
    const foot = this.contentEl.createDiv('scr-modal-actions');
    button(foot, { text: 'Закрыть', onClick: () => this.close() });
  }

  onClose() { this.resolve(this.result); }
}

/* ---------- входные точки ---------- */

/** Системный (или встроенный на Android) выбор папки. Возвращает абсолютный путь или null. */
async function pickFolder(app, opts = {}) {
  if (Platform.isDesktopApp) return pickDesktop(opts.title);
  if (Platform.isAndroidApp && fsApi(app)) {
    return new Promise((resolve) => new FolderBrowserModal(app, opts, resolve).open());
  }
  new Notice('На этом устройстве Obsidian не даёт выбрать папку вне хранилища');
  return null;
}

/** Выбор из папок Syncthing. Возвращает { path, label, versionsPath } или null. */
async function pickFromSyncthing(app, settings, { added, vaultPath }) {
  let folders;
  try {
    folders = await fetchFolders(settings);
  } catch (e) {
    new Notice(`Syncthing: ${e.message}`);
    return null;
  }
  const f = await new Promise((resolve) => new SyncthingFoldersModal(app, { folders, added, vaultPath }, resolve).open());
  if (!f) return null;
  return { path: expandHome(f.path), label: f.label || f.id, versionsPath: expandHome(f.versionsPath || '.stversions') };
}

/** «~/Sync» → «/Users/имя/Sync» на компьютере. */
function expandHome(p) {
  if (!p || !p.startsWith('~') || !Platform.isDesktopApp) return p;
  try { return require('path').join(require('os').homedir(), p.slice(1)); } catch (e) { return p; }
}

module.exports = { pickFolder, pickFromSyncthing, ANDROID_ROOT };
