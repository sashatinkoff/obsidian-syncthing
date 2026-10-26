'use strict';
/**
 * Вкладка «Журнал»: хронология решений. Сводные цифры — на вкладке «Статистика».
 */

const { ACTION_LABELS } = require('../journal');
const { formatDate } = require('../util');
const { formatDuration } = require('../stats');
const { button, icon, chip, emptyState, avatar } = require('./dom');

const ACTION_ICON = { merge: 'git-merge', keep: 'file-check', take: 'file-input', both: 'files', identical: 'copy-check' };

function renderJournalTab(view, el) {
  const core = view.core;
  const entries = core.journal.entries;
  const page = el.createDiv('scr-journal');

  if (!entries.length) {
    emptyState(page, { ico: 'history', title: 'Журнал пуст', text: 'Здесь появятся решённые конфликты.' });
    return;
  }

  const head = page.createDiv('scr-section-head');
  head.createDiv({ cls: 'scr-panel-title', text: `Последние действия · ${entries.length}` });
  button(head, { text: 'Статистика', icon: 'bar-chart-3', variant: 'ghost', onClick: () => view.setTab('stats') });

  const list = page.createDiv('scr-log');
  for (const e of entries.slice(0, 200)) {
    const row = list.createDiv('scr-log-row');
    icon(row.createDiv(`scr-log-ico scr-log-${e.action}`), ACTION_ICON[e.action] || 'dot');
    const body = row.createDiv('scr-log-body');
    body.createDiv({ cls: 'scr-log-path', text: e.path });
    const meta = body.createDiv('scr-log-meta');
    meta.createSpan({ text: ACTION_LABELS[e.action] || e.action });
    if (e.action === 'merge') meta.createSpan({ text: ` · авто ${e.auto || 0}, вручную ${e.manual || 0}${e.base ? ', с базой' : ''}` });
    if (e.copyTime) meta.createSpan({ text: ` · решено через ${formatDuration(e.t - e.copyTime)}` });
    if (e.target) meta.createSpan({ text: ` → ${e.target}` });
    const right = row.createDiv('scr-log-right');
    const dev = right.createDiv('scr-log-dev');
    avatar(dev, e.deviceName || e.device || '?', e.device);
    dev.createSpan({ text: core.deviceName(e.device) || e.deviceName || '—' });
    right.createDiv({ cls: 'scr-muted', text: formatDate(e.t) });
    if (e.source && e.source !== 'Хранилище') chip(right, e.source, 'muted');
  }
}

module.exports = { renderJournalTab };
