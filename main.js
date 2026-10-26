'use strict';
/**
 * Syncthing Conflict Resolver — загрузчик.
 *
 * Obsidian подгружает только main.js и не умеет require('./src/...') на телефоне,
 * поэтому модули из src/ читаются через адаптер хранилища и исполняются
 * маленькой CommonJS-обёрткой. Работает одинаково на десктопе, Android и iOS.
 */

const obsidian = require('obsidian');

class SourceLoader {
  constructor(app, manifest) {
    this.app = app;
    this.dir = manifest.dir;
    this.id = manifest.id;
    this.sources = new Map();
    this.cache = new Map();
  }

  async preload() {
    await this.walk(`${this.dir}/src`);
    if (!this.sources.size) throw new Error(`Не найдена папка src в ${this.dir}`);
  }

  async walk(folder) {
    const { files, folders } = await this.app.vault.adapter.list(folder);
    for (const f of files) {
      if (!f.endsWith('.js')) continue;
      const rel = f.slice(this.dir.length + 1);
      this.sources.set(rel, await this.app.vault.adapter.read(f));
    }
    for (const sub of folders) await this.walk(sub);
  }

  resolve(from, spec) {
    const parts = from.split('/').slice(0, -1);
    for (const p of spec.split('/')) {
      if (p === '.' || p === '') continue;
      if (p === '..') parts.pop();
      else parts.push(p);
    }
    let path = parts.join('/');
    if (!path.endsWith('.js')) path += '.js';
    return path;
  }

  load(from, spec) {
    if (!spec.startsWith('.')) return require(spec);
    const path = this.resolve(from, spec);
    const cached = this.cache.get(path);
    if (cached) return cached.exports;
    const code = this.sources.get(path);
    if (code === undefined) throw new Error(`Модуль не найден: ${path} (из ${from})`);
    const module = { exports: {} };
    this.cache.set(path, module);
    const fn = new Function('module', 'exports', 'require', `${code}\n//# sourceURL=plugin:${this.id}/${path}`);
    fn(module, module.exports, (s) => this.load(path, s));
    return module.exports;
  }
}

module.exports = class SyncthingConflictResolver extends obsidian.Plugin {
  async onload() {
    try {
      const loader = new SourceLoader(this.app, this.manifest);
      await loader.preload();
      const { Core } = loader.load('main.js', './src/plugin.js');
      this.core = new Core(this);
      await this.core.onload();
    } catch (e) {
      console.error('[Syncthing Conflict Resolver] не удалось загрузить', e);
      new obsidian.Notice(`Syncthing Conflict Resolver: ${e.message}`);
    }
  }

  onunload() {
    if (this.core) this.core.onunload();
  }
};
