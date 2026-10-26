'use strict';
/**
 * Источники файлов. Все пути внутри источника — относительные, через «/».
 *   VaultSource — хранилище Obsidian (работает везде, включая Android/iOS)
 *   FsSource    — произвольная папка на диске через Node fs (только десктоп)
 */

const { TFile, Platform } = require('obsidian');
const { joinPath } = require('../util');

const SKIP_DIRS = new Set(['.stversions', '.stfolder', '.stignore', '.git', 'node_modules', '.sync-conflict-trash']);

class VaultSource {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.adapter = plugin.app.vault.adapter;
    this.kind = 'vault';
    this.id = 'vault';
    this.label = 'Хранилище';
    this.root = '';
  }

  /** Ключ для сопоставления с .stversions (путь относительно папки Syncthing). */
  syncKey(path) {
    return joinPath(this.plugin.settings.vaultSubpath, path);
  }

  async listAll() {
    const s = this.plugin.settings;
    const files = this.app.vault.getFiles().map((f) => f.path);
    if (s.scanConfigDir) {
      const cfg = this.app.vault.configDir;
      files.push(...(await this.listRecursive(cfg)));
    }
    return files;
  }

  async listRecursive(dir) {
    const out = [];
    const walk = async (d) => {
      let r;
      try { r = await this.adapter.list(d); } catch (e) { return; }
      out.push(...r.files);
      for (const f of r.folders) {
        const name = f.slice(f.lastIndexOf('/') + 1);
        if (name === 'node_modules' || name === '.git') continue;
        await walk(f);
      }
    };
    await walk(dir);
    return out;
  }

  file(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  async exists(path) {
    if (this.app.vault.getAbstractFileByPath(path)) return true;
    return this.adapter.exists(path);
  }

  async stat(path) {
    const f = this.file(path);
    if (f && f.stat) return { mtime: f.stat.mtime, size: f.stat.size };
    try {
      const s = await this.adapter.stat(path);
      return s ? { mtime: s.mtime, size: s.size } : null;
    } catch (e) { return null; }
  }

  async read(path) {
    const f = this.file(path);
    return f ? this.app.vault.read(f) : this.adapter.read(path);
  }

  async readBinary(path) {
    const f = this.file(path);
    return f ? this.app.vault.readBinary(f) : this.adapter.readBinary(path);
  }

  async write(path, text) {
    const f = this.file(path);
    if (f) await this.app.vault.modify(f, text);
    else await this.adapter.write(path, text);
  }

  async writeBinary(path, data) {
    const f = this.file(path);
    if (f && this.app.vault.modifyBinary) await this.app.vault.modifyBinary(f, data);
    else await this.adapter.writeBinary(path, data);
  }

  async rename(from, to) {
    const f = this.file(from);
    if (f) await this.app.vault.rename(f, to);
    else await this.adapter.rename(from, to);
  }

  async remove(path, mode) {
    const f = this.file(path);
    if (mode === 'delete') {
      if (f) await this.app.vault.delete(f);
      else await this.adapter.remove(path);
      return;
    }
    if (mode === 'system') {
      if (f) { await this.app.vault.trash(f, true); return; }
      const ok = await this.adapter.trashSystem(path);
      if (ok) return;
    }
    if (f) await this.app.vault.trash(f, false);
    else await this.adapter.trashLocal(path);
  }

  resourceUrl(path) {
    return this.adapter.getResourcePath(path);
  }

  /** Источник для папки версий: внутри хранилища — этот же, абсолютный путь — Fs (только десктоп). */
  versionsLocation() {
    const vp = (this.plugin.settings.versionsPath || '').trim();
    if (!vp) return null;
    if (/^([a-zA-Z]:[\\/]|\/)/.test(vp)) {
      if (!Platform.isDesktopApp) return null;
      return { source: new FsSource(vp, 'Версии'), dir: '' };
    }
    return { source: this, dir: vp.replace(/^\/+|\/+$/g, '') };
  }

  openable(path) { return !!this.file(path); }
}

class FsSource {
  constructor(root, label) {
    this.fs = require('fs').promises;
    this.nodePath = require('path');
    this.root = root;
    this.kind = 'fs';
    this.id = `fs:${root}`;
    this.label = label || root;
    this.blobUrls = [];
  }

  abs(rel) { return rel ? this.nodePath.join(this.root, ...rel.split('/')) : this.root; }
  syncKey(path) { return path; }

  /** Проверка доступа к папке: { ok, error }. */
  async check() {
    try {
      const s = await this.fs.stat(this.root);
      if (!s.isDirectory()) return { ok: false, error: 'Это не папка' };
      await this.fs.readdir(this.root);
      return { ok: true };
    } catch (e) {
      if (e.code === 'ENOENT') return { ok: false, error: 'Папка не найдена' };
      if (e.code === 'EACCES' || e.code === 'EPERM') return { ok: false, error: 'Нет доступа к папке' };
      return { ok: false, error: e.message };
    }
  }

  async listAll(excluded = []) {
    return this.listRecursive('', excluded);
  }

  async listRecursive(relDir, excluded = []) {
    const out = [];
    const walk = async (rel) => {
      let entries;
      try { entries = await this.fs.readdir(this.abs(rel), { withFileTypes: true }); } catch (e) { return; }
      for (const e of entries) {
        const child = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (SKIP_DIRS.has(e.name)) continue;
          if (excluded.some((x) => child === x || child.startsWith(`${x}/`))) continue;
          await walk(child);
        } else if (e.isFile()) {
          out.push(child);
        }
      }
    };
    await walk(relDir);
    return out;
  }

  async exists(rel) {
    try { await this.fs.access(this.abs(rel)); return true; } catch (e) { return false; }
  }

  async stat(rel) {
    try {
      const s = await this.fs.stat(this.abs(rel));
      return { mtime: s.mtimeMs, size: s.size };
    } catch (e) { return null; }
  }

  async read(rel) { return this.fs.readFile(this.abs(rel), 'utf8'); }

  async readBinary(rel) {
    const b = await this.fs.readFile(this.abs(rel));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }

  async write(rel, text) { await this.fs.writeFile(this.abs(rel), text, 'utf8'); }
  async writeBinary(rel, data) { await this.fs.writeFile(this.abs(rel), Buffer.from(data)); }
  async rename(from, to) { await this.fs.rename(this.abs(from), this.abs(to)); }

  async remove(rel, mode) {
    const full = this.abs(rel);
    if (mode === 'delete') { await this.fs.unlink(full); return; }
    try {
      const { shell } = require('electron');
      if (shell && shell.trashItem) { await shell.trashItem(full); return; }
    } catch (e) { /* нет доступа к корзине — уберём в локальную папку */ }
    const trashDir = this.nodePath.join(this.root, '.sync-conflict-trash');
    await this.fs.mkdir(trashDir, { recursive: true });
    const target = this.nodePath.join(trashDir, `${Date.now()}-${this.nodePath.basename(full)}`);
    await this.fs.rename(full, target);
  }

  resourceUrl(rel) {
    // Картинки вне хранилища показываем через blob: читаем файл целиком
    return null;
  }

  versionsLocation(versionsPath) {
    const vp = (versionsPath || '.stversions').trim();
    if (/^([a-zA-Z]:[\\/]|\/)/.test(vp)) return { source: new FsSource(vp, 'Версии'), dir: '' };
    return { source: this, dir: vp };
  }

  openable() { return false; }
}

/* ---------- Android: папки вне хранилища через файловый API приложения ---------- */

function capacitorFs(app) {
  const cap = window.Capacitor;
  const fs = (cap && cap.Plugins && cap.Plugins.Filesystem) || (app && app.vault.adapter && app.vault.adapter.fs);
  return fs && typeof fs.readdir === 'function' && typeof fs.readFile === 'function' ? fs : null;
}

function base64ToBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Папка на телефоне (Android) вне хранилища, например /storage/emulated/0/Syncthing/Docs.
 * Экспериментально: работает, если у Obsidian есть доступ ко всем файлам
 * (так обычно и есть, когда хранилище лежит в общей памяти телефона).
 */
class MobileFsSource {
  constructor(app, root, label) {
    this.app = app;
    this.fsApi = capacitorFs(app);
    this.root = root.replace(/\/+$/, '');
    this.kind = 'mobile';
    this.id = `mobile:${this.root}`;
    this.label = label || this.root.split('/').pop();
  }

  static available(app) { return !!capacitorFs(app); }

  uri(rel) {
    const base = this.root.startsWith('file://') ? this.root : `file://${this.root.startsWith('/') ? '' : '/'}${this.root}`;
    return rel ? `${base}/${rel.split('/').map(encodeURIComponent).join('/')}` : base;
  }

  syncKey(path) { return path; }

  async check() {
    if (!this.fsApi) return { ok: false, error: 'Файловый API недоступен на этом устройстве' };
    try {
      await this.fsApi.readdir({ path: this.uri('') });
      return { ok: true };
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/not exist|no such|ENOENT/i.test(msg)) return { ok: false, error: 'Папка не найдена' };
      if (/permission|denied|EACCES/i.test(msg)) return { ok: false, error: 'Нет доступа: разрешите Obsidian доступ ко всем файлам' };
      return { ok: false, error: msg };
    }
  }

  async entries(rel) {
    const r = await this.fsApi.readdir({ path: this.uri(rel) });
    const out = [];
    for (const f of r.files || []) {
      if (typeof f === 'string') {
        const child = rel ? `${rel}/${f}` : f;
        let type = 'file';
        try { type = (await this.fsApi.stat({ path: this.uri(child) })).type; } catch (e) { /* считаем файлом */ }
        out.push({ name: f, dir: type === 'directory' });
      } else {
        out.push({ name: f.name, dir: f.type === 'directory' });
      }
    }
    return out;
  }

  async listAll(excluded = []) { return this.listRecursive('', excluded); }

  async listRecursive(relDir, excluded = []) {
    const out = [];
    const walk = async (rel) => {
      let list;
      try { list = await this.entries(rel); } catch (e) { return; }
      for (const e of list) {
        const child = rel ? `${rel}/${e.name}` : e.name;
        if (e.dir) {
          if (SKIP_DIRS.has(e.name)) continue;
          if (excluded.some((x) => child === x || child.startsWith(`${x}/`))) continue;
          await walk(child);
        } else {
          out.push(child);
        }
      }
    };
    await walk(relDir);
    return out;
  }

  async exists(rel) {
    try { await this.fsApi.stat({ path: this.uri(rel) }); return true; } catch (e) { return false; }
  }

  async stat(rel) {
    try {
      const s = await this.fsApi.stat({ path: this.uri(rel) });
      return { mtime: Number(s.mtime || s.ctime || 0), size: Number(s.size || 0) };
    } catch (e) { return null; }
  }

  async read(rel) {
    const r = await this.fsApi.readFile({ path: this.uri(rel), encoding: 'utf8' });
    return typeof r.data === 'string' ? r.data : await r.data.text();
  }

  async readBinary(rel) {
    const r = await this.fsApi.readFile({ path: this.uri(rel) });
    return typeof r.data === 'string' ? base64ToBuffer(r.data) : await r.data.arrayBuffer();
  }

  async write(rel, text) { await this.fsApi.writeFile({ path: this.uri(rel), data: text, encoding: 'utf8' }); }
  async writeBinary(rel, data) { await this.fsApi.writeFile({ path: this.uri(rel), data: bufferToBase64(data) }); }
  async rename(from, to) { await this.fsApi.rename({ from: this.uri(from), to: this.uri(to) }); }

  async remove(rel, mode) {
    if (mode === 'delete') { await this.fsApi.deleteFile({ path: this.uri(rel) }); return; }
    // Корзины на телефоне нет — переносим в служебную папку внутри синхронизируемой
    try { await this.fsApi.mkdir({ path: this.uri('.sync-conflict-trash'), recursive: true }); } catch (e) { /* уже есть */ }
    const name = rel.split('/').pop();
    await this.fsApi.rename({ from: this.uri(rel), to: this.uri(`.sync-conflict-trash/${Date.now()}-${name}`) });
  }

  resourceUrl() { return null; }

  versionsLocation(versionsPath) {
    const vp = (versionsPath || '.stversions').trim().replace(/^\/+|\/+$/g, '');
    return { source: this, dir: vp };
  }

  openable() { return false; }
}

/** Источник для папки из настроек под текущую платформу (или null, если здесь недоступно). */
function createFolderSource(app, folder) {
  if (!folder || !folder.path) return null;
  const label = folder.label || folder.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  let src = null;
  if (Platform.isDesktopApp) src = new FsSource(folder.path, label);
  else if (Platform.isAndroidApp && MobileFsSource.available(app)) src = new MobileFsSource(app, folder.path, label);
  if (src) src.versionsPath = folder.versionsPath || '.stversions';
  return src;
}

/** Можно ли на этом устройстве работать с папками вне хранилища. */
function deviceFoldersSupport(app) {
  if (Platform.isDesktopApp) return 'desktop';
  if (Platform.isAndroidApp && MobileFsSource.available(app)) return 'android';
  return null;
}

/** Выбор папки на десктопе: диалог Electron, иначе скрытый input. */
async function pickFolder() {
  try {
    const electron = require('electron');
    let remote = electron.remote;
    if (!remote) { try { remote = require('@electron/remote'); } catch (e) { remote = null; } }
    if (remote && remote.dialog) {
      const r = await remote.dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
      return r.filePaths[0];
    }
  } catch (e) { /* переходим к запасному варианту */ }

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

module.exports = { VaultSource, FsSource, MobileFsSource, createFolderSource, deviceFoldersSupport, pickFolder };
