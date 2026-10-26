#!/usr/bin/env node
'use strict';
/**
 * Необязательная сборка в один файл: dist/main.js со всеми модулями src/ внутри.
 * Нужна, если плагин ставится установщиком, который копирует только
 * main.js + manifest.json + styles.css (папку src он не переносит).
 *
 *   node tools/build-single.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const modules = walk(srcDir).sort().map((full) => {
  const rel = path.relative(root, full).split(path.sep).join('/');
  const code = fs.readFileSync(full, 'utf8');
  return `  ${JSON.stringify(rel)}: function (module, exports, require) {\n${code}\n  },`;
});

const out = `'use strict';
/* Syncthing Conflict Resolver — однофайловая сборка (сгенерировано tools/build-single.js). */
const obsidian = require('obsidian');

const MODULES = {
${modules.join('\n')}
};

const cache = new Map();
function resolve(from, spec) {
  const parts = from.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '.' || p === '') continue;
    if (p === '..') parts.pop(); else parts.push(p);
  }
  let file = parts.join('/');
  if (!file.endsWith('.js')) file += '.js';
  return file;
}
function load(from, spec) {
  if (!spec.startsWith('.')) return require(spec);
  const file = resolve(from, spec);
  if (cache.has(file)) return cache.get(file).exports;
  const fn = MODULES[file];
  if (!fn) throw new Error('Модуль не найден: ' + file);
  const module = { exports: {} };
  cache.set(file, module);
  fn(module, module.exports, (s) => load(file, s));
  return module.exports;
}

module.exports = class SyncthingConflictResolver extends obsidian.Plugin {
  async onload() {
    try {
      const { Core } = load('main.js', './src/plugin.js');
      this.core = new Core(this);
      await this.core.onload();
    } catch (e) {
      console.error('[Syncthing Conflict Resolver] не удалось загрузить', e);
      new obsidian.Notice('Syncthing Conflict Resolver: ' + e.message);
    }
  }
  onunload() { if (this.core) this.core.onunload(); }
};
`;

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'main.js'), out);
for (const f of ['manifest.json', 'styles.css', 'README.md']) {
  if (fs.existsSync(path.join(root, f))) fs.copyFileSync(path.join(root, f), path.join(distDir, f));
}
const shots = path.join(root, 'screenshots');
if (fs.existsSync(shots)) {
  fs.mkdirSync(path.join(distDir, 'screenshots'), { recursive: true });
  for (const f of fs.readdirSync(shots)) fs.copyFileSync(path.join(shots, f), path.join(distDir, 'screenshots', f));
}
console.log(`dist/main.js: ${modules.length} модулей, ${(out.length / 1024).toFixed(1)} КБ`);
