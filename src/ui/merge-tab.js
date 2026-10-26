'use strict';
/**
 * Вкладка «Сверка»: три колонки как в Android Studio —
 * текущая версия | результат | конфликтная копия.
 * На узком экране колонки складываются в стопку.
 */

const { Menu, Platform } = require('obsidian');
const { wordDiff } = require('../core/diff');
const { resultLines } = require('../core/merge');
const { formatDate, formatSize, relativeAge, plural, mimeOf } = require('../util');
const { button, icon, chip, emptyState, avatar, confirm } = require('./dom');

/* ---------- отрисовка строк ---------- */

function segmentsToLines(segs) {
  const lines = [[]];
  for (const s of segs) {
    const parts = s.text.split('\n');
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ text: p, mark: s.mark });
    });
  }
  return lines;
}

function renderLines(cell, lines, startNo, opts = {}) {
  const box = cell.createDiv({ cls: ['scr-code'].concat(opts.cls ? [opts.cls] : []) });
  lines.forEach((line, i) => {
    const row = box.createDiv('scr-line');
    row.createSpan({ cls: 'scr-ln', text: startNo === null ? '' : String(startNo + i) });
    const tx = row.createSpan('scr-tx');
    if (Array.isArray(line)) {
      if (!line.length) tx.setText('​');
      for (const seg of line) tx.createSpan({ text: seg.text, cls: seg.mark ? 'scr-word' : '' });
    } else {
      tx.setText(line === '' ? '​' : line);
    }
  });
  if (!lines.length) box.createDiv({ cls: 'scr-line scr-line-void', text: opts.voidText || 'нет строк' });
  return box;
}

function chunkWordDiff(ch) {
  if (ch._wd !== undefined) return ch._wd;
  ch._wd = null;
  if (ch.left.length && ch.right.length) {
    const wd = wordDiff(ch.left.join('\n'), ch.right.join('\n'));
    if (wd) ch._wd = { left: segmentsToLines(wd.left), right: segmentsToLines(wd.right) };
  }
  return ch._wd;
}

const DECISION_LABEL = {
  left: 'Текущая',
  right: 'Копия',
  'both-lr': 'Обе: текущая + копия',
  'both-rl': 'Обе: копия + текущая',
  base: 'База',
  custom: 'Вручную',
};

function chunkState(ch) {
  if (ch.decision === null) return 'conflict';
  const autoDecision = ch.auto === 'same' ? 'left' : ch.auto;
  if (ch.auto && ch.decision === autoDecision) return 'auto';
  return 'resolved';
}

/* ---------- шапка ---------- */

function renderHead(view, wrap, s) {
  const { group, copy } = s;
  const core = view.core;
  const head = wrap.createDiv('scr-merge-head');

  const top = head.createDiv('scr-merge-top');
  button(top, { icon: 'arrow-left', title: 'К списку конфликтов', variant: 'ghost', onClick: () => view.setTab('list') });
  const title = top.createDiv('scr-merge-title');
  title.createDiv({ text: group.name, cls: 'scr-merge-name' });
  const sub = title.createDiv('scr-merge-path');
  sub.setText(group.path);
  if (group.renamedFrom) chip(sub, `переименован из ${group.renamedFrom.split('/').pop()}`, 'manual', 'file-input');
  if (group.source.kind !== 'vault') chip(sub, group.source.label, 'muted', 'folder-open');
  if (group.copies.length > 1) {
    const idx = group.copies.indexOf(copy) + 1;
    chip(sub, `копия ${idx} из ${group.copies.length}`, 'muted');
  }
  if (group.source.openable(group.path)) {
    button(top, {
      icon: 'file-text', title: 'Открыть файл', variant: 'ghost',
      onClick: () => core.app.workspace.openLinkText(group.path, '', 'split'),
    });
  }

  const sides = head.createDiv({ cls: ['scr-sides'].concat(s.mode === 'text' ? [] : ['scr-sides-2']) });
  const left = sides.createDiv('scr-side-card scr-side-left');
  left.createDiv({ text: 'Текущая версия', cls: 'scr-side-title' });
  left.createDiv({
    cls: 'scr-side-meta',
    text: s.origStat ? `${formatDate(s.origStat.mtime)} · ${formatSize(s.origStat.size)}` : 'файл отсутствует',
  });

  if (s.mode === 'text') {
    const base = sides.createDiv('scr-side-card scr-side-base');
    base.createDiv({ text: 'База (общий предок)', cls: 'scr-side-title' });
    const sel = base.createEl('select', { cls: 'dropdown scr-base-select' });
    const add = (value, text) => { const o = sel.createEl('option', { text, value }); if (value === s.baseChoice) o.selected = true; };
    add('auto', s.baseChoice === 'auto' && s.baseVersion ? `Авто: ${formatDate(s.baseVersion.time)}` : 'Авто');
    add('none', 'Без базы — двустороннее');
    for (const v of group.versions) add(v.path, formatDate(v.time));
    sel.addEventListener('change', async () => {
      if (s.hasManualDecisions()) {
        const ok = await confirm(core.app, {
          title: 'Сменить базу?',
          text: 'Блоки пересчитаются, решения, принятые вручную, сбросятся.',
          confirm: 'Сменить',
        });
        if (!ok) { sel.value = s.baseChoice; return; }
      }
      await s.applyBase(sel.value);
      view.rerender(true);
    });
    base.createDiv({
      cls: 'scr-side-meta',
      text: group.versions.length
        ? `${group.versions.length} ${plural(group.versions.length, 'версия', 'версии', 'версий')} в .stversions`
        : 'версий в .stversions нет',
    });
  }

  const right = sides.createDiv('scr-side-card scr-side-right');
  const rt = right.createDiv('scr-side-title');
  avatar(rt, core.deviceName(copy.device), copy.device);
  rt.createSpan({ text: `Копия · ${core.deviceName(copy.device)}` });
  right.createDiv({
    cls: 'scr-side-meta',
    text: `${formatDate(copy.time)} · ${formatSize(s.copyStat ? s.copyStat.size : copy.size)}`,
  });
}

/* ---------- текстовая сверка ---------- */

function renderText(view, wrap, s) {
  const st = s.stats();
  if (st.total === 0) {
    emptyState(wrap, {
      ico: 'check-circle-2',
      title: 'Содержимое совпадает',
      text: s.core.settings.ignoreTrailingWhitespace
        ? 'Отличия только в пробелах в конце строк или переводах строк.'
        : 'Отличаются только переводы строк — копию можно смело убрать.',
      action: { text: 'Убрать копию', variant: 'primary', icon: 'trash-2', onClick: () => view.runAction('identical') },
    });
    return;
  }

  if (s.baseWarning) {
    const w = wrap.createDiv('scr-banner scr-banner-warn');
    icon(w, 'alert-triangle');
    w.createSpan({
      text: s.baseWarning === 'left'
        ? 'База совпадает с текущей версией: автослияние фактически берёт все изменения копии. Проверьте блоки или выберите другую базу.'
        : 'База совпадает с копией: автослияние фактически оставляет текущую версию. Проверьте блоки или выберите другую базу.',
    });
  } else if (!s.baseText && s.group.versions.length === 0) {
    const w = wrap.createDiv('scr-banner');
    icon(w, 'info');
    w.createSpan({ text: 'Общий предок не найден — каждое отличие нужно решить вручную. Включите версионирование папки в Syncthing, чтобы появилось автослияние.' });
  }

  renderToolbar(view, wrap, s, st);

  const grid = wrap.createDiv('scr-grid');
  const hdr = grid.createDiv('scr-grid-head');
  hdr.createDiv({ cls: 'scr-col-title scr-col-left', text: 'Текущая версия' });
  hdr.createDiv({ cls: 'scr-col-title scr-col-mid', text: 'Результат' });
  hdr.createDiv({ cls: 'scr-col-title scr-col-right', text: `Копия · ${s.core.deviceName(s.copy.device)}` });

  const ctx = Math.max(0, Number(s.core.settings.contextLines) || 0);
  const chunks = s.model.chunks;
  let lnL = 1;
  let lnR = 1;
  let lnM = 1;

  chunks.forEach((ch, idx) => {
    if (ch.type === 'stable') {
      const n = ch.lines.length;
      const isFirst = idx === 0;
      const isLast = idx === chunks.length - 1;
      const headN = isFirst ? 0 : ctx;
      const tailN = isLast ? 0 : ctx;
      if (!s.expanded.has(idx) && n > headN + tailN + 2) {
        if (headN) renderStable(grid, ch.lines.slice(0, headN), lnL, lnR, lnM);
        const hidden = n - headN - tailN;
        const fold = grid.createDiv('scr-fold');
        icon(fold, 'unfold-vertical');
        fold.createSpan({ text: `${hidden} ${plural(hidden, 'строка', 'строки', 'строк')} без изменений` });
        fold.addEventListener('click', () => { s.expanded.add(idx); view.rerender(true); });
        if (tailN) renderStable(grid, ch.lines.slice(n - tailN), lnL + n - tailN, lnR + n - tailN, lnM + n - tailN);
      } else {
        renderStable(grid, ch.lines, lnL, lnR, lnM);
      }
      lnL += n; lnR += n; lnM += n;
      return;
    }
    renderChange(view, grid, s, ch, lnL, lnR, lnM);
    lnL += ch.left.length;
    lnR += ch.right.length;
    const res = resultLines(ch);
    if (res) lnM += res.length;
  });

  renderFooter(view, wrap, s, st);
}

function renderStable(grid, lines, lnL, lnR, lnM) {
  const row = grid.createDiv('scr-row scr-stable');
  renderLines(row.createDiv('scr-cell scr-left'), lines, lnL);
  renderLines(row.createDiv('scr-cell scr-mid'), lines, lnM);
  renderLines(row.createDiv('scr-cell scr-right'), lines, lnR);
}

function renderChange(view, grid, s, ch, lnL, lnR, lnM) {
  const state = chunkState(ch);
  const row = grid.createDiv({ cls: ['scr-row', 'scr-change', `is-${state}`] });
  row.dataset.id = ch.id;
  const wd = chunkWordDiff(ch);

  // Левая колонка
  const lc = row.createDiv('scr-cell scr-left');
  const lh = lc.createDiv('scr-cell-head');
  lh.createSpan({ cls: 'scr-cell-label', text: 'Текущая' });
  if (ch.label) chip(lh, ch.label, 'prop', 'list');
  button(lh, {
    icon: 'chevrons-right', title: 'Принять текущую версию блока', variant: 'take-left',
    cls: ch.decision === 'left' ? 'is-on' : null,
    onClick: () => { s.decide(ch, 'left'); view.rerender(true); },
  });
  renderLines(lc, wd ? wd.left : ch.left, lnL, { cls: 'scr-code-left', voidText: ch.label ? 'свойства нет' : 'строк нет' });

  // Середина — результат
  const mc = row.createDiv('scr-cell scr-mid');
  const mh = mc.createDiv('scr-cell-head');
  const pill = mh.createSpan({ cls: `scr-state scr-state-${state}` });
  if (state === 'conflict') pill.setText('Конфликт');
  else if (state === 'auto') pill.setText(ch.auto === 'same' ? 'Одинаково' : `Авто: ${ch.auto === 'left' ? 'текущая' : 'копия'}`);
  else pill.setText(DECISION_LABEL[ch.decision]);
  const tools = mh.createDiv('scr-mid-tools');
  button(tools, { text: 'Т+К', title: 'Оба: сначала текущая, потом копия', variant: 'mini', cls: ch.decision === 'both-lr' ? 'is-on' : null, onClick: () => { s.decide(ch, 'both-lr'); view.rerender(true); } });
  button(tools, { text: 'К+Т', title: 'Оба: сначала копия, потом текущая', variant: 'mini', cls: ch.decision === 'both-rl' ? 'is-on' : null, onClick: () => { s.decide(ch, 'both-rl'); view.rerender(true); } });
  if (ch.base) button(tools, { text: 'База', title: 'Вернуть как было в базе', variant: 'mini', cls: ch.decision === 'base' ? 'is-on' : null, onClick: () => { s.decide(ch, 'base'); view.rerender(true); } });
  button(tools, {
    icon: 'pencil', title: 'Править вручную', variant: 'mini', cls: ch.decision === 'custom' ? 'is-on' : null,
    onClick: () => {
      const current = resultLines(ch) || (ch.left.length ? ch.left : ch.right);
      ch.custom = current.slice();
      s.decide(ch, 'custom');
      s.editing = ch.id;
      view.rerender(true);
    },
  });
  if (state !== 'conflict' || ch.custom) {
    button(tools, { icon: 'rotate-ccw', title: 'Сбросить решение', variant: 'mini', onClick: () => { s.resetChunk(ch); view.rerender(true); } });
  }

  if (s.editing === ch.id) {
    const ta = mc.createEl('textarea', { cls: 'scr-editor' });
    ta.value = (ch.custom || []).join('\n');
    ta.rows = Math.min(24, Math.max(3, (ch.custom || []).length + 1));
    ta.addEventListener('input', () => { ch.custom = ta.value.split('\n'); });
    const act = mc.createDiv('scr-editor-actions');
    button(act, { text: 'Готово', variant: 'primary', onClick: () => { s.editing = null; view.rerender(true); } });
    setTimeout(() => ta.focus(), 0);
  } else {
    const res = resultLines(ch);
    if (res === null) {
      const ph = mc.createDiv('scr-placeholder');
      ph.setText(Platform.isMobile || view.isNarrow()
        ? 'Выберите: текущая, копия, обе или правка'
        : '← возьмите текущую, копию → или оба варианта');
    } else {
      const from = ch.decision === 'left' ? 'scr-from-left'
        : ch.decision === 'right' ? 'scr-from-right'
          : ch.decision === 'custom' ? 'scr-from-custom' : 'scr-from-mixed';
      renderLines(mc, res, lnM, { cls: from, voidText: 'блок удалён' });
    }
  }

  // Правая колонка
  const rc = row.createDiv('scr-cell scr-right');
  const rh = rc.createDiv('scr-cell-head');
  button(rh, {
    icon: 'chevrons-left', title: 'Принять версию копии', variant: 'take-right',
    cls: ch.decision === 'right' ? 'is-on' : null,
    onClick: () => { s.decide(ch, 'right'); view.rerender(true); },
  });
  rh.createSpan({ cls: 'scr-cell-label', text: 'Копия' });
  renderLines(rc, wd ? wd.right : ch.right, lnR, { cls: 'scr-code-right', voidText: ch.label ? 'свойства нет' : 'строк нет' });
}

function renderToolbar(view, wrap, s, st) {
  const bar = wrap.createDiv('scr-merge-toolbar');
  const prog = bar.createDiv('scr-progress');
  const done = st.total - st.unresolved;
  prog.createDiv({ cls: 'scr-progress-text', text: `Решено ${done} из ${st.total}` });
  const track = prog.createDiv('scr-progress-track');
  track.createDiv('scr-progress-fill').style.width = `${st.total ? (done / st.total) * 100 : 100}%`;
  const chips = bar.createDiv('scr-merge-chips');
  if (st.auto) chip(chips, `авто ${st.auto}`, 'auto', 'sparkles');
  if (st.manual) chip(chips, `вручную ${st.manual}`, 'manual', 'hand');
  if (st.unresolved) chip(chips, `конфликтов ${st.unresolved}`, 'conflict', 'alert-circle');

  const nav = bar.createDiv('scr-merge-nav');
  button(nav, { icon: 'chevron-up', title: 'Предыдущий конфликт', variant: 'ghost', disabled: !st.unresolved, onClick: () => view.jumpConflict(-1) });
  button(nav, { icon: 'chevron-down', title: 'Следующий конфликт', variant: 'ghost', disabled: !st.unresolved, onClick: () => view.jumpConflict(1) });
  button(nav, {
    icon: 'more-horizontal', title: 'Массовые действия', variant: 'ghost',
    onClick: (e) => {
      const m = new Menu();
      m.addItem((i) => i.setTitle('Все нерешённые — текущая').setIcon('chevrons-right').onClick(() => { s.decideAllUnresolved('left'); view.rerender(true); }));
      m.addItem((i) => i.setTitle('Все нерешённые — копия').setIcon('chevrons-left').onClick(() => { s.decideAllUnresolved('right'); view.rerender(true); }));
      m.addItem((i) => i.setTitle('Все нерешённые — обе (Т+К)').setIcon('copy').onClick(() => { s.decideAllUnresolved('both-lr'); view.rerender(true); }));
      m.addSeparator();
      m.addItem((i) => i.setTitle('Развернуть все строки').setIcon('unfold-vertical').onClick(() => {
        s.model.chunks.forEach((c, idx) => s.expanded.add(idx));
        view.rerender(true);
      }));
      m.addItem((i) => i.setTitle('Сбросить все решения').setIcon('rotate-ccw').onClick(() => {
        s.changes().forEach((c) => s.resetChunk(c));
        view.rerender(true);
      }));
      m.showAtMouseEvent(e);
    },
  });
}

function renderFooter(view, wrap, s, st) {
  const f = wrap.createDiv('scr-merge-footer');
  const left = f.createDiv('scr-footer-left');
  button(left, { text: 'Оставить текущую', title: 'Оставить текущую версию целиком', icon: 'file-check', variant: 'ghost', onClick: () => view.runAction('keep') });
  button(left, { text: 'Взять копию', title: 'Взять копию целиком', icon: 'file-input', variant: 'ghost', onClick: () => view.runAction('take') });
  button(left, { text: 'Оставить обе', title: 'Сохранить копию отдельным файлом', icon: 'files', variant: 'ghost', onClick: () => view.runAction('both') });
  const right = f.createDiv('scr-footer-right');
  if (st.unresolved) right.createSpan({ cls: 'scr-footer-hint', text: `Осталось ${st.unresolved} ${plural(st.unresolved, 'конфликт', 'конфликта', 'конфликтов')}` });
  button(right, {
    text: 'Сохранить результат', icon: 'check', variant: 'primary', disabled: st.unresolved > 0,
    onClick: () => view.saveMerge(),
  });
}

/* ---------- бинарные файлы и картинки ---------- */

async function previewInto(el, s, path) {
  const { group } = s;
  if (group.kind !== 'image') {
    icon(el.createDiv('scr-bin-ico'), 'file');
    return;
  }
  let url = group.source.resourceUrl(path);
  if (!url) {
    try {
      const data = await group.source.readBinary(path);
      url = s.trackBlob(URL.createObjectURL(new Blob([data], { type: mimeOf(path) })));
    } catch (e) { url = null; }
  }
  if (url) el.createEl('img', { attr: { src: url, alt: '' } });
}

function renderBinary(view, wrap, s) {
  const { group, copy } = s;
  const grid = wrap.createDiv('scr-bin');
  const card = (title, path, meta, ico, action, variant) => {
    const c = grid.createDiv(`scr-bin-card scr-bin-${variant}`);
    c.createDiv({ cls: 'scr-side-title', text: title });
    const pv = c.createDiv('scr-bin-preview');
    previewInto(pv, s, path);
    c.createDiv({ cls: 'scr-side-meta', text: meta });
    button(c, { text: action.text, icon: ico, variant: 'primary', onClick: action.onClick });
  };
  card('Текущая версия', group.path, s.origStat ? `${formatDate(s.origStat.mtime)} · ${formatSize(s.origStat.size)}` : '',
    'file-check', { text: 'Оставить текущую', onClick: () => view.runAction('keep') }, 'left');
  card(`Копия · ${view.core.deviceName(copy.device)}`, copy.path, `${formatDate(copy.time)} · ${formatSize(s.copyStat ? s.copyStat.size : copy.size)}`,
    'file-input', { text: 'Взять копию', onClick: () => view.runAction('take') }, 'right');
  const f = wrap.createDiv('scr-merge-footer');
  f.createDiv({ cls: 'scr-footer-hint', text: group.kind === 'image' ? 'Картинки сравниваются целиком.' : 'Двоичный файл — построчная сверка невозможна.' });
  button(f.createDiv('scr-footer-right'), { text: 'Оставить обе', icon: 'files', variant: 'ghost', onClick: () => view.runAction('both') });
}

function renderMissing(view, wrap, s) {
  const { copy } = s;
  const b = wrap.createDiv('scr-banner scr-banner-warn');
  icon(b, 'file-x');
  b.createSpan({ text: 'Исходного файла нет: на одном устройстве его удалили или переименовали, а на другом изменили.' });
  const card = wrap.createDiv('scr-bin-card scr-bin-right scr-missing');
  card.createDiv({ cls: 'scr-side-title', text: `Копия · ${view.core.deviceName(copy.device)} · ${relativeAge(copy.time)}` });
  if (s.rightText !== undefined) {
    const pre = card.createEl('pre', { cls: 'scr-missing-pre' });
    pre.setText(s.rightText.length > 4000 ? `${s.rightText.slice(0, 4000)}\n…` : s.rightText);
  } else {
    previewInto(card.createDiv('scr-bin-preview'), s, copy.path);
  }
  const f = wrap.createDiv('scr-merge-footer');
  const r = f.createDiv('scr-footer-right');
  button(r, { text: 'Удалить копию', icon: 'trash-2', variant: 'ghost', onClick: () => view.runAction('keep') });
  button(r, { text: 'Восстановить из копии', icon: 'undo-2', variant: 'primary', onClick: () => view.runAction('take') });
}

/* ---------- вход ---------- */

function renderMergeTab(view, el) {
  const s = view.session;
  if (!s) {
    emptyState(el, {
      ico: 'git-compare',
      title: 'Ничего не открыто',
      text: 'Выберите конфликт на вкладке «Конфликты» и нажмите «Сверить».',
      action: { text: 'К списку', icon: 'list', onClick: () => view.setTab('list') },
    });
    return;
  }
  if (s.loading) {
    emptyState(el, { ico: 'loader', title: 'Загружаю версии…' });
    return;
  }
  const wrap = el.createDiv('scr-merge');
  renderHead(view, wrap, s);
  if (s.error) {
    const b = wrap.createDiv('scr-banner scr-banner-error');
    icon(b, 'x-circle');
    b.createSpan({ text: `Не удалось прочитать файлы: ${s.error}` });
    return;
  }
  if (s.mode === 'binary') renderBinary(view, wrap, s);
  else if (s.mode === 'missing') renderMissing(view, wrap, s);
  else renderText(view, wrap, s);
}

module.exports = { renderMergeTab };
