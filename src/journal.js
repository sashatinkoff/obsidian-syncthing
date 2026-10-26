'use strict';

const ACTION_LABELS = {
  merge: 'Слияние',
  keep: 'Оставлена текущая',
  take: 'Взята копия',
  both: 'Оставлены обе',
  identical: 'Идентичная копия',
};

class Journal {
  constructor(plugin, entries) {
    this.plugin = plugin;
    this.entries = Array.isArray(entries) ? entries : [];
  }

  add(entry) {
    this.entries.unshift(entry);
    const limit = this.plugin.settings.journalLimit || 500;
    if (this.entries.length > limit) this.entries.length = limit;
    // Сохраняем не чаще раза в секунду: при массовых действиях data.json не перезаписывается тысячи раз
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.plugin.saveData_();
    }, 1000);
  }

  clear() {
    this.entries = [];
    this.plugin.saveData_();
  }

  summary() {
    const weekAgo = Date.now() - 7 * 864e5;
    const byDevice = new Map();
    const byAction = new Map();
    let week = 0;
    let autoBlocks = 0;
    let manualBlocks = 0;
    for (const e of this.entries) {
      if (e.t >= weekAgo) week += e.n || 1;
      autoBlocks += e.auto || 0;
      manualBlocks += e.manual || 0;
      const dn = e.deviceName || e.device || '—';
      byDevice.set(dn, (byDevice.get(dn) || 0) + 1);
      byAction.set(e.action, (byAction.get(e.action) || 0) + 1);
    }
    return {
      total: this.entries.length,
      week,
      autoBlocks,
      manualBlocks,
      byDevice: [...byDevice.entries()].sort((a, b) => b[1] - a[1]),
      byAction: [...byAction.entries()].sort((a, b) => b[1] - a[1]),
    };
  }
}

module.exports = { Journal, ACTION_LABELS };
