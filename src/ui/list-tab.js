'use strict';
/**
 * Вкладка «Конфликты»: сводка, фильтры, карточки файлов с копиями, массовые действия.
 */

const { Menu, Notice } = require('obsidian');
const { formatDate, formatSize, relativeAge, plural } = require('../util');
const { button, icon, chip, statCard, emptyState, avatar, confirm } = require('./dom');

const FILTERS = [
  ['all', 'Все'],
  ['text', 'Текст'],
  ['media', 'Медиа и файлы'],
  ['identical', 'Идентичные'],
  ['base', 'Есть база'],
];

const KIND_ICON = { text: 'file-text', image: 'image', binary: 'file' };

function copyKey(group, copy) { return `${group.source.id}::${copy.path}`; }

function matches(group, state) {
  if (state.source && group.source.id !== state.source) return false;
  const q = state.query.trim().toLowerCase();
  if (q && !group.path.toLowerCase().includes(q)) return false;
  switch (state.filter) {
    case 'text': return group.kind === 'text';
    case 'media': return group.kind !== 'text';
    case 'identical': return group.copies.some((c) => c.identical);
    case 'base': return group.versions.length > 0;
    default: return true;
  }
}

function renderListTab(view, el) {
  const core = view.core;
  const scan = core.scan;
  const state = view.listState;

  if (!scan) {
    emptyState(el, { ico: 'loader', title: 'Ищу конфликты…' });
    return;
  }

  const groups = scan.groups;
  const copies = groups.reduce((n, g) => n + g.copies.length, 0);
  const identical = groups.reduce((n, g) => n + g.copies.filter((c) => c.identical).length, 0);
  const devices = new Set(groups.flatMap((g) => g.copies.map((c) => c.device)));

  const page = el.createDiv('scr-list');

  const stats = page.createDiv('scr-stats');
  statCard(stats, { label: 'Конфликтных копий', value: copies, ico: 'git-merge', variant: copies ? 'warn' : 'ok', hint: copies ? 'ждут решения' : 'всё чисто' });
  statCard(stats, { label: 'Файлов', value: groups.length, ico: 'files' });
  statCard(stats, { label: 'Идентичных', value: identical, ico: 'copy-check', hint: identical ? 'можно убрать сразу' : null });
  statCard(stats, { label: 'Устройств', value: devices.size, ico: 'smartphone' });

  renderSources(view, page, scan);

  if (!groups.length) {
    emptyState(page, {
      ico: 'check-circle-2',
      title: 'Конфликтов нет',
      text: `Последняя проверка: ${formatDate(scan.scannedAt)}`,
      action: { text: 'Проверить снова', icon: 'refresh-cw', onClick: () => core.rescan() },
    });
    return;
  }

  // Панель фильтров
  const tb = page.createDiv('scr-toolbar');
  const search = tb.createDiv('scr-search');
  icon(search, 'search');
  const input = search.createEl('input', { type: 'search', placeholder: 'Поиск по пути…' });
  input.value = state.query;
  input.addEventListener('input', () => {
    state.query = input.value;
    view.rerender(false, () => {
      const i = view.bodyEl.querySelector('.scr-search input');
      if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
  });
  const seg = tb.createDiv('scr-seg');
  for (const [key, label] of FILTERS) {
    const b = seg.createEl('button', { text: label, cls: state.filter === key ? 'is-active' : '' });
    b.addEventListener('click', () => { state.filter = key; view.rerender(); });
  }
  if (identical) {
    button(tb, {
      text: `Убрать идентичные (${identical})`, icon: 'sparkles', variant: 'soft',
      onClick: () => view.cleanIdentical(),
    });
  }

  // Панель выделения
  const visible = groups.filter((g) => matches(g, state));
  const selected = [];
  for (const g of groups) for (const c of g.copies) if (state.selected.has(copyKey(g, c))) selected.push([g, c]);
  if (selected.length) {
    const sb = page.createDiv('scr-selbar');
    sb.createSpan({ cls: 'scr-selbar-count', text: `Выбрано: ${selected.length}` });
    button(sb, { text: 'Оставить текущие', icon: 'file-check', variant: 'soft', onClick: () => view.bulk('keep', selected) });
    button(sb, { text: 'Взять копии', icon: 'file-input', variant: 'soft', onClick: () => view.bulk('take', selected) });
    button(sb, { text: 'Оставить обе', icon: 'files', variant: 'soft', onClick: () => view.bulk('both', selected) });
    button(sb, { icon: 'x', title: 'Снять выделение', variant: 'ghost', onClick: () => { state.selected.clear(); view.rerender(); } });
  }

  const list = page.createDiv('scr-groups');
  if (!visible.length) {
    list.createDiv({ cls: 'scr-muted scr-pad', text: 'Под фильтр ничего не попало.' });
  }

  for (const g of visible) {
    const card = list.createDiv('scr-group');
    const head = card.createDiv('scr-group-head');

    const allSel = g.copies.every((c) => state.selected.has(copyKey(g, c)));
    const cb = head.createEl('input', { type: 'checkbox', cls: 'scr-check' });
    cb.checked = allSel;
    cb.addEventListener('change', () => {
      for (const c of g.copies) {
        if (cb.checked) state.selected.add(copyKey(g, c));
        else state.selected.delete(copyKey(g, c));
      }
      view.rerender();
    });

    icon(head.createDiv(`scr-kind scr-kind-${g.kind}`), KIND_ICON[g.kind] || 'file');
    const title = head.createDiv('scr-group-title');
    title.createDiv({ cls: 'scr-group-name', text: g.name });
    const path = title.createDiv('scr-group-path');
    path.setText(g.path);
    const badges = head.createDiv('scr-badges');
    if (g.source.kind !== 'vault') chip(badges, g.source.label, 'muted', 'folder-open');
    if (!g.exists) chip(badges, 'исходный удалён', 'conflict', 'file-x');
    if (g.versions.length) chip(badges, `база: ${g.versions.length}`, 'auto', 'history');
    if (g.copies.length > 1) chip(badges, `${g.copies.length} ${plural(g.copies.length, 'копия', 'копии', 'копий')}`, 'muted');

    const rows = card.createDiv('scr-copies');
    for (const c of g.copies) {
      const r = rows.createDiv('scr-copy');
      const ccb = r.createEl('input', { type: 'checkbox', cls: 'scr-check' });
      ccb.checked = state.selected.has(copyKey(g, c));
      ccb.addEventListener('change', () => {
        if (ccb.checked) state.selected.add(copyKey(g, c));
        else state.selected.delete(copyKey(g, c));
        view.rerender();
      });
      const name = core.deviceName(c.device);
      avatar(r, name, c.device);
      const info = r.createDiv('scr-copy-info');
      const line1 = info.createDiv('scr-copy-dev');
      line1.createSpan({ text: name });
      if (name !== c.device) line1.createSpan({ cls: 'scr-muted', text: c.device });
      const line2 = info.createDiv('scr-copy-meta');
      line2.setText(`${formatDate(c.time)} · ${relativeAge(c.time)}`);
      if (c.size !== null && g.size !== null) {
        const d = c.size - g.size;
        line2.appendText(` · ${formatSize(c.size)}`);
        if (d) line2.createSpan({ cls: d > 0 ? 'scr-plus' : 'scr-minus', text: ` ${d > 0 ? '+' : '−'}${formatSize(Math.abs(d))}` });
      }
      const tags = r.createDiv('scr-badges');
      if (c.identical === true) chip(tags, 'идентична', 'ok', 'check');
      else if (c.identical === null) chip(tags, '…', 'muted');

      const act = r.createDiv('scr-copy-actions');
      if (c.identical) {
        button(act, { text: 'Убрать', icon: 'trash-2', variant: 'soft', onClick: () => view.runFor(g, c, 'identical') });
      } else {
        button(act, { text: g.exists ? 'Сверить' : 'Разобрать', icon: 'git-compare', variant: 'primary', onClick: () => view.openMerge(g, c) });
      }
      button(act, {
        icon: 'more-vertical', title: 'Ещё', variant: 'ghost',
        onClick: (e) => {
          const m = new Menu();
          m.addItem((i) => i.setTitle('Сверить').setIcon('git-compare').onClick(() => view.openMerge(g, c)));
          m.addSeparator();
          m.addItem((i) => i.setTitle(g.exists ? 'Оставить текущую' : 'Удалить копию').setIcon('file-check').onClick(() => view.runFor(g, c, 'keep')));
          m.addItem((i) => i.setTitle(g.exists ? 'Взять копию' : 'Восстановить из копии').setIcon('file-input').onClick(() => view.runFor(g, c, 'take')));
          if (g.exists) m.addItem((i) => i.setTitle('Оставить обе').setIcon('files').onClick(() => view.runFor(g, c, 'both')));
          if (g.source.openable(c.path)) {
            m.addSeparator();
            m.addItem((i) => i.setTitle('Открыть копию').setIcon('external-link').onClick(() => core.app.workspace.openLinkText(c.path, '', 'tab')));
          }
          m.showAtMouseEvent(e);
        },
      });
    }
  }
}

/** Полоса проверенных папок: хранилище и папки на устройстве, с состоянием и числом конфликтов. */
function renderSources(view, page, scan) {
  const sources = scan.sources || [];
  if (sources.length < 2 && sources.every((s) => s.ok)) return;
  const state = view.listState;
  const strip = page.createDiv('scr-sources');
  const head = strip.createDiv('scr-sources-head');
  icon(head, 'folder-search');
  head.createSpan({ text: 'Проверенные папки' });
  button(head, {
    text: 'Добавить папку', icon: 'folder-plus', variant: 'ghost',
    onClick: () => { view.app.setting.open(); view.app.setting.openTabById(view.core.manifest.id); },
  });
  const row = strip.createDiv('scr-sources-row');
  for (const s of sources) {
    const card = row.createDiv({ cls: ['scr-source'].concat(s.ok ? [] : ['is-error']).concat(state.source === s.id ? ['is-active'] : []) });
    icon(card.createDiv('scr-source-ico'), s.kind === 'vault' ? 'vault' : s.ok ? 'folder' : 'folder-x');
    const body = card.createDiv('scr-source-body');
    body.createDiv({ cls: 'scr-source-name', text: s.label });
    const meta = body.createDiv('scr-source-meta');
    if (!s.ok) meta.setText(s.error);
    else meta.setText(`${s.files} ${plural(s.files, 'файл', 'файла', 'файлов')} · ${s.ms < 1000 ? `${s.ms} мс` : `${(s.ms / 1000).toFixed(1)} с`}`);
    if (s.ok) {
      card.createDiv({ cls: ['scr-source-count'].concat(s.conflicts ? ['is-warn'] : []), text: String(s.conflicts) });
      card.addEventListener('click', () => {
        state.source = state.source === s.id ? null : s.id;
        view.rerender();
      });
      card.setAttr('title', state.source === s.id ? 'Показать все папки' : 'Показать конфликты только этой папки');
    }
  }
}

module.exports = { renderListTab, copyKey };
