'use strict';
/**
 * Состояние одной сверки: тексты, база, модель блоков, развёрнутые участки.
 * Без DOM — только данные.
 */

const { buildModel, assemble, stats } = require('../core/merge');
const { pickBase } = require('../io/scanner');
const { looksBinary } = require('../util');

class MergeSession {
  constructor(core, group, copy) {
    this.core = core;
    this.group = group;
    this.copy = copy;
    this.loading = true;
    this.error = null;
    this.mode = 'text'; // text | binary | missing
    this.baseChoice = core.settings.autoBase ? 'auto' : 'none';
    this.baseVersion = null;
    this.baseText = null;
    this.baseWarning = null;
    this.model = null;
    this.expanded = new Set();
    this.editing = null;
    this.blobUrls = [];
  }

  async load() {
    const { group, copy } = this;
    const src = group.source;
    try {
      this.copyStat = await src.stat(copy.path);
      this.origStat = group.exists ? await src.stat(group.path) : null;

      if (!group.exists) {
        this.mode = 'missing';
        if (group.kind === 'text') this.rightText = await src.read(copy.path);
        return;
      }
      if (group.kind !== 'text') { this.mode = 'binary'; return; }

      const [lb, rb] = await Promise.all([src.readBinary(group.path), src.readBinary(copy.path)]);
      if (looksBinary(lb) || looksBinary(rb)) { this.mode = 'binary'; return; }

      this.leftText = await src.read(group.path);
      this.rightText = await src.read(copy.path);
      await this.applyBase(this.baseChoice);
    } catch (e) {
      console.error('[Syncthing Conflict Resolver]', e);
      this.error = e.message || String(e);
    } finally {
      this.loading = false;
    }
  }

  async applyBase(choice) {
    const { group, copy } = this;
    this.baseChoice = choice;
    let ver = null;
    if (choice === 'auto') ver = pickBase(group, copy);
    else if (choice !== 'none') ver = group.versions.find((v) => v.path === choice) || null;
    this.baseVersion = ver;
    this.baseText = null;
    if (ver) {
      try { this.baseText = await ver.source.read(ver.path); } catch (e) { this.baseVersion = null; }
    }
    const norm = (t) => (t || '').replace(/\r\n/g, '\n');
    this.baseWarning = null;
    if (this.baseText !== null) {
      if (norm(this.baseText) === norm(this.leftText)) this.baseWarning = 'left';
      else if (norm(this.baseText) === norm(this.rightText)) this.baseWarning = 'right';
    }
    const s = this.core.settings;
    this.model = buildModel({
      left: this.leftText,
      right: this.rightText,
      base: this.baseText,
      ignoreTrailingWhitespace: s.ignoreTrailingWhitespace,
      mergeProperties: s.mergeProperties,
    });
    this.expanded.clear();
    this.editing = null;
  }

  changes() { return this.model ? this.model.chunks.filter((c) => c.type === 'change') : []; }
  stats() { return this.model ? stats(this.model) : { total: 0, auto: 0, unresolved: 0, manual: 0 }; }
  result() { return this.model ? assemble(this.model) : null; }

  hasManualDecisions() {
    return this.changes().some((c) => c.decision !== null && c.decision !== (c.auto === 'same' ? 'left' : c.auto));
  }

  decide(chunk, decision) {
    chunk.decision = decision;
    if (decision !== 'custom') this.editing = null;
  }

  resetChunk(chunk) {
    chunk.decision = chunk.auto === 'same' ? 'left' : chunk.auto;
    chunk.custom = null;
    this.editing = null;
  }

  decideAllUnresolved(decision) {
    for (const c of this.changes()) if (c.decision === null) c.decision = decision;
  }

  trackBlob(url) { this.blobUrls.push(url); return url; }

  dispose() {
    for (const u of this.blobUrls) URL.revokeObjectURL(u);
    this.blobUrls = [];
  }
}

module.exports = { MergeSession };
