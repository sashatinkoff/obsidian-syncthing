'use strict';
/**
 * Вкладка «Статистика»: сколько конфликтов появляется и решается, за сколько, где и откуда.
 */

const { ACTION_LABELS } = require('../journal');
const { formatDuration } = require('../stats');
const { button, icon, statCard, emptyState, confirm } = require('./dom');

const PERIODS = [[7, '7 дней'], [30, '30 дней'], [90, '90 дней'], [null, 'Всё время']];
const KINDS = { text: 'Текст', image: 'Картинки', binary: 'Другие файлы' };
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function bars(parent, title, rows, opts = {}) {
  const box = parent.createDiv('scr-panel');
  const head = box.createDiv('scr-panel-title');
  if (opts.ico) icon(head, opts.ico);
  head.createSpan({ text: title });
  const max = Math.max(1, ...rows.map((r) => r[1]));
  for (const [key, n] of rows.slice(0, opts.limit || 8)) {
    const row = box.createDiv('scr-bar');
    const label = row.createDiv({ cls: 'scr-bar-label', text: opts.label ? opts.label(key) : String(key) });
    label.setAttr('title', opts.label ? opts.label(key) : String(key));
    if (opts.onClick) { label.addClass('is-link'); label.addEventListener('click', () => opts.onClick(key)); }
    const track = row.createDiv('scr-bar-track');
    track.createDiv(`scr-bar-fill${opts.variant ? ` scr-bar-${opts.variant}` : ''}`).style.width = `${(n / max) * 100}%`;
    row.createDiv({ cls: 'scr-bar-value', text: String(n) });
  }
  if (!rows.length) box.createDiv({ cls: 'scr-muted', text: 'Пока нет данных' });
  return box;
}

function dailyChart(parent, series) {
  const box = parent.createDiv('scr-panel scr-chart-panel');
  const head = box.createDiv('scr-chart-head');
  const title = head.createDiv('scr-panel-title');
  icon(title, 'bar-chart-3');
  title.createSpan({ text: 'По дням' });
  const legend = head.createDiv('scr-legend');
  legend.createSpan({ cls: 'scr-legend-item scr-legend-detected', text: 'появилось' });
  legend.createSpan({ cls: 'scr-legend-item scr-legend-resolved', text: 'решено' });

  const max = Math.max(1, ...series.map((d) => Math.max(d.detected, d.resolved)));
  const chart = box.createDiv('scr-chart');
  chart.style.setProperty('--scr-cols', String(series.length));
  const labelEvery = series.length <= 10 ? 1 : series.length <= 31 ? 5 : series.length <= 92 ? 14 : 30;
  series.forEach((d, i) => {
    const col = chart.createDiv('scr-chart-col');
    col.setAttr('title', `${d.date.getDate()} ${MONTHS_SHORT[d.date.getMonth()]}: появилось ${d.detected}, решено ${d.resolved}`);
    const stack = col.createDiv('scr-chart-bars');
    stack.createDiv('scr-chart-bar scr-chart-detected').style.height = `${(d.detected / max) * 100}%`;
    stack.createDiv('scr-chart-bar scr-chart-resolved').style.height = `${(d.resolved / max) * 100}%`;
    const showLabel = (series.length - 1 - i) % labelEvery === 0;
    col.createDiv({ cls: 'scr-chart-label', text: showLabel ? `${d.date.getDate()} ${MONTHS_SHORT[d.date.getMonth()]}` : '' });
  });
  chart.createDiv({ cls: 'scr-chart-max', text: String(max) });
}

function renderStatsTab(view, el) {
  const core = view.core;
  const state = view.statsState;
  const sum = core.stats.summary(state.period);
  const page = el.createDiv('scr-statspage');

  const tb = page.createDiv('scr-toolbar');
  const seg = tb.createDiv('scr-seg');
  for (const [days, label] of PERIODS) {
    const b = seg.createEl('button', { text: label, cls: state.period === days ? 'is-active' : '' });
    b.addEventListener('click', () => { state.period = days; view.rerender(false); });
  }
  const right = tb.createDiv('scr-toolbar-right');
  button(right, { text: 'Отчёт в заметку', icon: 'file-plus-2', variant: 'soft', onClick: () => core.writeStatsNote() });
  button(right, {
    icon: 'trash-2', title: 'Сбросить статистику и журнал', variant: 'ghost',
    onClick: async () => {
      const ok = await confirm(core.app, {
        title: 'Сбросить статистику?',
        text: 'Удалятся история обнаруженных конфликтов и журнал решений. Файлы не затрагиваются.',
        confirm: 'Сбросить', danger: true,
      });
      if (!ok) return;
      core.stats.clear();
      await core.saveData_();
      view.rerender(false);
    },
  });

  const stats = page.createDiv('scr-stats scr-stats-5');
  statCard(stats, { label: 'Появилось', value: sum.detected, ico: 'alert-circle', variant: sum.detected ? 'warn' : null, hint: 'конфликтных копий' });
  statCard(stats, { label: 'Решено', value: sum.resolved, ico: 'check-check', variant: 'ok' });
  statCard(stats, { label: 'Открыто сейчас', value: sum.open, ico: 'git-merge', variant: sum.open ? 'warn' : 'ok' });
  statCard(stats, {
    label: 'До решения', value: formatDuration(sum.medianMs), ico: 'timer',
    hint: sum.avgMs !== null ? `медиана · в среднем ${formatDuration(sum.avgMs)}` : 'медиана',
  });
  statCard(stats, {
    label: 'Автослияние', value: sum.autoRate === null ? '—' : `${Math.round(sum.autoRate * 100)}%`, ico: 'sparkles',
    hint: `блоков: авто ${sum.autoBlocks}, вручную ${sum.manualBlocks}`,
  });

  if (!sum.detected && !sum.resolved) {
    emptyState(page, {
      ico: 'bar-chart-3',
      title: 'Данных пока нет',
      text: 'Статистика копится с момента установки: каждый найденный и каждый решённый конфликт попадает сюда.',
    });
    return;
  }

  dailyChart(page, sum.series);

  const panels = page.createDiv('scr-panels');
  bars(panels, 'Откуда приходят (устройства)', sum.byDevice, { ico: 'smartphone' });
  bars(panels, 'Где возникают (папки)', sum.byFolder, { ico: 'folder' });
  bars(panels, 'Самые конфликтные файлы', sum.topFiles, {
    ico: 'flame', variant: 'warn', limit: 10,
    label: (p) => p,
    onClick: (p) => core.app.workspace.openLinkText(p, '', 'tab'),
  });
  bars(panels, 'Как решались', sum.byAction, { ico: 'git-compare', label: (k) => ACTION_LABELS[k] || k });
  bars(panels, 'Типы файлов', sum.byKind, { ico: 'files', label: (k) => KINDS[k] || k });
  const wd = WEEKDAYS.map((_, i) => [i, (sum.byWeekday.find((x) => x[0] === i) || [i, 0])[1]]);
  bars(panels, 'По дням недели', wd, { ico: 'calendar', label: (i) => WEEKDAYS[i], limit: 7 });
}

module.exports = { renderStatsTab };
