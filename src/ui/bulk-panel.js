'use strict';
/**
 * Панель «Умный разбор» на вкладке «Конфликты»: что за конфликты, сколько их, как разобрать пачкой.
 */

const { CATEGORIES, CATEGORY_ORDER } = require('../io/bulk');
const { plural } = require('../util');
const { button, icon } = require('./dom');

/** Категории, которые разбираются без потери данных. */
const SAFE = [
  ['identical', 'remove'],
  ['whitespace', 'remove'],
  ['current-newer', 'remove'],
  ['copy-newer', 'take'],
  ['auto', 'merge'],
];

const fmt = (n) => n.toLocaleString('ru-RU');

function eta(state) {
  const elapsed = Date.now() - state.started;
  if (!state.done || elapsed < 1500) return '';
  const left = (elapsed / state.done) * (state.total - state.done);
  const s = Math.round(left / 1000);
  if (s < 60) return ` · осталось ~${s} с`;
  return ` · осталось ~${Math.round(s / 60)} мин`;
}

function renderProgress(view, parent) {
  const st = view.core.bulk.state;
  const box = parent.createDiv('scr-bulk scr-bulk-running');
  const head = box.createDiv('scr-bulk-head');
  icon(head.createDiv('scr-bulk-ico is-spinning'), 'loader');
  const t = head.createDiv('scr-bulk-title');
  t.createDiv({ cls: 'scr-bulk-name', text: st.label });
  t.createDiv({ cls: 'scr-bulk-sub', attr: { 'data-bulk-text': '' }, text: `${fmt(st.done)} из ${fmt(st.total)}${eta(st)}` });
  button(head, { text: 'Остановить', icon: 'x', variant: 'ghost', onClick: () => view.core.bulk.cancel() });
  const track = box.createDiv('scr-progress-track scr-bulk-track');
  const fill = track.createDiv({ cls: 'scr-progress-fill', attr: { 'data-bulk-fill': '' } });
  fill.style.width = `${st.total ? (st.done / st.total) * 100 : 0}%`;
}

/** Обновление полосы прогресса без перерисовки страницы. */
function updateProgress(root, core) {
  const st = core.bulk.state;
  if (!st) return false;
  const fill = root.querySelector('[data-bulk-fill]');
  const text = root.querySelector('[data-bulk-text]');
  if (!fill || !text) return false;
  fill.style.width = `${st.total ? (st.done / st.total) * 100 : 0}%`;
  text.setText(`${fmt(st.done)} из ${fmt(st.total)}${eta(st)}`);
  return true;
}

function renderBulkPanel(view, parent, scan) {
  const core = view.core;
  if (core.bulk.state) { renderProgress(view, parent); return; }
  const a = scan.analysis;
  const total = scan.groups.reduce((n, g) => n + g.copies.length, 0);
  if (!total) return;

  if (!a || !a.done) {
    const box = parent.createDiv('scr-bulk');
    const head = box.createDiv('scr-bulk-head');
    icon(head.createDiv('scr-bulk-ico'), 'sparkles');
    const t = head.createDiv('scr-bulk-title');
    t.createDiv({ cls: 'scr-bulk-name', text: 'Умный разбор' });
    t.createDiv({ cls: 'scr-bulk-sub', text: a ? `Анализ остановлен: ${fmt(a.analyzed || 0)} из ${fmt(a.total)}` : 'Копии ещё не проанализированы' });
    button(head, { text: 'Проанализировать', icon: 'sparkles', variant: 'primary', onClick: () => core.bulk.analyze(scan) });
    return;
  }

  const counts = a.counts;
  const safeCount = SAFE.reduce((n, [c]) => n + (counts[c] || 0), 0);
  const manual = total - safeCount;

  const box = parent.createDiv('scr-bulk');
  const head = box.createDiv('scr-bulk-head');
  icon(head.createDiv('scr-bulk-ico'), 'sparkles');
  const t = head.createDiv('scr-bulk-title');
  t.createDiv({ cls: 'scr-bulk-name', text: 'Умный разбор' });
  t.createDiv({
    cls: 'scr-bulk-sub',
    text: safeCount
      ? `${fmt(safeCount)} из ${fmt(total)} можно разобрать без потери данных${manual ? `, ${fmt(manual)} — посмотреть` : ''}`
      : `Все ${fmt(total)} требуют решения`,
  });
  if (safeCount) {
    button(head, {
      text: `Разобрать безопасные (${fmt(safeCount)})`, icon: 'check-check', variant: 'primary',
      onClick: () => view.runSafe(SAFE),
    });
  }

  const renamed = scan.groups.filter((g) => g.renamedFrom).reduce((n, g) => n + g.copies.length, 0);
  if (renamed) {
    const note = box.createDiv('scr-banner scr-bulk-note');
    icon(note, 'file-input');
    note.createSpan({
      text: `${fmt(renamed)} ${plural(renamed, 'копия относится', 'копии относятся', 'копий относятся')} к переименованным файлам: под старым именем файла уже нет, зато он нашёлся под новым. Такие копии сравниваются с новым файлом, восстанавливать старые имена не нужно.`,
    });
  }

  const rows = box.createDiv('scr-bulk-rows');
  for (const cat of CATEGORY_ORDER) {
    const n = counts[cat] || 0;
    if (!n) continue;
    const meta = CATEGORIES[cat];
    const row = rows.createDiv({ cls: ['scr-bulk-row', `is-${meta.tone}`].concat(view.listState.filter === cat ? ['is-active'] : []) });
    icon(row.createDiv('scr-bulk-row-ico'), meta.ico);
    const body = row.createDiv('scr-bulk-row-body');
    const line = body.createDiv('scr-bulk-row-line');
    line.createSpan({ cls: 'scr-bulk-row-name', text: meta.label });
    line.createSpan({ cls: 'scr-bulk-row-count', text: fmt(n) });
    if (SAFE.some(([c]) => c === cat)) line.createSpan({ cls: 'scr-chip scr-chip-ok', text: 'безопасно' });
    body.createDiv({ cls: 'scr-bulk-row-hint', text: meta.hint });
    body.addEventListener('click', () => {
      view.listState.filter = view.listState.filter === cat ? 'all' : cat;
      view.listState.limit = 50;
      view.rerender(false);
    });
    body.setAttr('title', 'Показать эти копии в списке');
    const acts = row.createDiv('scr-bulk-row-actions');
    for (const act of meta.actions) {
      button(acts, {
        text: act.text, variant: act.primary ? 'soft' : 'ghost',
        onClick: () => view.runBulk(cat, act.id),
      });
    }
  }
  if (a.ms) box.createDiv({ cls: 'scr-bulk-foot', text: `Проанализировано ${fmt(a.total)} ${plural(a.total, 'копия', 'копии', 'копий')} за ${(a.ms / 1000).toFixed(1)} с` });
}

module.exports = { renderBulkPanel, updateProgress, SAFE };
