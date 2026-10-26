#!/usr/bin/env node
'use strict';
/**
 * Собирает main.js из модулей src/ — все модули оказываются внутри одного файла.
 * Так плагин работает, даже если установщик копирует только
 * main.js + manifest.json + styles.css.
 *
 * Запускать после правок в src/:   node tools/build-single.js
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const outFile = path.join(root, 'main.js');

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
/*
 * Syncthing Conflict Resolver
 * Файл собран из src/ командой «node tools/build-single.js» — правьте модули в src/, а не этот файл.
 * Все модули внутри, поэтому достаточно скопировать main.js, manifest.json и styles.css.
 */
const obsidian = require('obsidian');

const README = ${JSON.stringify(fs.existsSync(path.join(root, 'README.md')) ? fs.readFileSync(path.join(root, 'README.md'), 'utf8') : '')};

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
      globalThis.__SCR_README = README;
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

fs.writeFileSync(outFile, out);
console.log(`main.js: ${modules.length} модулей, ${(out.length / 1024).toFixed(1)} КБ`);
