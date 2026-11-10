'use strict';
/**
 * Окно плагина — обычная вкладка рабочей области (на весь экран, не модальное).
 * Вкладки: Конфликты · Сверка · Журнал.
 */

const { ItemView, Notice } = require('obsidian');
const { VIEW_TYPE, ICON } = require('../constants');
const { formatDate, plural } = require('../util');
const { button, icon, confirm } = require('./dom');
const { MergeSession } = require('./merge-session');
const { renderListTab } = require('./list-tab');
const { renderMergeTab } = require('./merge-tab');
const { renderJournalTab } = require('./journal-tab');
const { renderStatsTab } = require('./stats-tab');
const { updateProgress } = require('./bulk-panel');
const { CATEGORIES } = require('../io/bulk');

const ACTION_TEXT = {
  keep: 'Оставлена текущая версия',
  take: 'Взята версия копии',
  both: 'Обе версии сохранены',
  identical: 'Идентичная копия убрана',
};

class ConflictView extends ItemView {
  constructor(leaf, core) {
    super(leaf);
    this.core = core;
    this.tab = 'list';
    this.session = null;
    this.listState = { query: '', filter: 'all', source: null, selected: new Set(), limit: 50 };
    this.statsState = { period: 30 };
    this.navigation = true;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'Конфликты Syncthing'; }
  getIcon() { return ICON; }

  async onOpen() {
    this.unsubscribe = this.core.subscribe((kind) => this.onScanUpdated(kind));
    this.render();
    if (!this.core.scan && !this.core.scanning) this.core.rescan();
  }

  async onClose() {
    if (this.unsubscribe) this.unsubscribe();
    if (this.session) this.session.dispose();
  }

  onResize() {
    const narrow = this.isNarrow();
    this.contentEl.toggleClass('scr-narrow', narrow);
  }

  isNarrow() { return this.contentEl.clientWidth > 0 && this.contentEl.clientWidth < 820; }

  onScanUpdated(kind) {
    if (kind === 'progress') {
      // Ход анализа / массового действия: двигаем полосу, не трогая остальное
      this.updateSubtitle();
      if (this.tab === 'list' && updateProgress(this.bodyEl, this.core)) return;
      if (this.tab === 'list' && this.core.bulk.state && !this.bodyEl.querySelector('[data-bulk-fill]')) this.rerender(true);
      return;
    }
    this.renderHeader();
    if (this.tab !== 'merge') this.rerender(true);
  }

  subtitleText() {
    const st = this.core.bulk.state;
    if (st) return `${st.label}: ${Math.round((st.done / Math.max(1, st.total)) * 100)}%`;
    const scan = this.core.scan;
    return this.core.scanning ? 'Проверяю…' : scan ? `Проверено ${formatDate(scan.scannedAt)}` : 'Ещё не проверялось';
  }

  updateSubtitle() {
    const el = this.headerEl && this.headerEl.querySelector('.scr-brand-sub');
    if (el) el.setText(this.subtitleText());
  }

  render() {
    const root = this.contentEl;
    root.empty();
    root.addClass('scr-root');
    root.toggleClass('scr-narrow', this.isNarrow());
    this.headerEl = root.createDiv('scr-header');
    this.bodyEl = root.createDiv('scr-body');
    this.renderHeader();
    this.renderBody();
  }

  renderHeader() {
    if (!this.headerEl) return;
    const h = this.headerEl;
    h.empty();
    const brand = h.createDiv('scr-brand');
    icon(brand.createDiv('scr-brand-ico'), ICON);
    const bt = brand.createDiv('scr-brand-text');
    bt.createDiv({ cls: 'scr-brand-title', text: 'Конфликты Syncthing' });
    const scan = this.core.scan;
    bt.createDiv({
      cls: 'scr-brand-sub',
      text: this.subtitleText(),
    });

    const tabs = h.createDiv('scr-tabs');
    const count = this.core.conflictCount();
    const tab = (id, label, ico, badge) => {
      const t = tabs.createEl('button', { cls: ['scr-tab'].concat(this.tab === id ? ['is-active'] : []) });
      icon(t, ico);
      t.createSpan({ text: label });
      if (badge) t.createSpan({ cls: 'scr-tab-badge', text: badge.toLocaleString('ru-RU') });
      t.addEventListener('click', () => this.setTab(id));
    };
    tab('list', 'Конфликты', 'list', count);
    tab('merge', 'Сверка', 'git-compare', null);
    tab('stats', 'Статистика', 'bar-chart-3', null);
    tab('journal', 'Журнал', 'history', null);

    const right = h.createDiv('scr-header-actions');
    const refresh = button(right, {
      icon: 'refresh-cw', title: 'Проверить заново', variant: 'ghost',
      onClick: () => this.core.rescan(),
    });
    if (this.core.scanning) refresh.addClass('is-spinning');
    button(right, {
      icon: 'settings', title: 'Настройки', variant: 'ghost',
      onClick: () => {
        this.app.setting.open();
        this.app.setting.openTabById(this.core.manifest.id);
      },
    });
  }

  renderBody() {
    const b = this.bodyEl;
    b.empty();
    b.dataset.tab = this.tab;
    if (this.tab === 'list') renderListTab(this, b);
    else if (this.tab === 'merge') renderMergeTab(this, b);
    else if (this.tab === 'stats') renderStatsTab(this, b);
    else renderJournalTab(this, b);
  }

  rerender(keepScroll = true, after) {
    const top = this.bodyEl ? this.bodyEl.scrollTop : 0;
    this.renderBody();
    if (keepScroll && this.bodyEl) this.bodyEl.scrollTop = top;
    if (after) after();
  }

  setTab(id) {
    this.tab = id;
    this.renderHeader();
    this.rerender(false);
  }

  /* ---------- сверка ---------- */

  async openMerge(group, copy) {
    if (this.session) this.session.dispose();
    this.session = new MergeSession(this.core, group, copy);
    this.setTab('merge');
    await this.session.load();
    if (this.tab === 'merge') this.rerender(false);
    setTimeout(() => this.jumpConflict(0), 50);
  }

  jumpConflict(dir) {
    const rows = [...this.bodyEl.querySelectorAll('.scr-change.is-conflict')];
    if (!rows.length) return;
    const bodyTop = this.bodyEl.getBoundingClientRect().top;
    const offset = 120;
    let target;
    if (dir === 0) {
      target = rows[0];
    } else if (dir > 0) {
      target = rows.find((r) => r.getBoundingClientRect().top - bodyTop > offset + 8) || rows[0];
    } else {
      const before = rows.filter((r) => r.getBoundingClientRect().top - bodyTop < offset - 8);
      target = before.length ? before[before.length - 1] : rows[rows.length - 1];
    }
    this.bodyEl.scrollTo({ top: this.bodyEl.scrollTop + target.getBoundingClientRect().top - bodyTop - offset, behavior: 'smooth' });
    target.addClass('is-flash');
    setTimeout(() => target.removeClass('is-flash'), 900);
  }

  async saveMerge() {
    const s = this.session;
    const text = s.result();
    if (text === null) { new Notice('Остались нерешённые конфликты'); return; }
    const st = s.stats();
    try {
      await this.core.actions.saveMerged(s.group, s.copy, text, { auto: st.auto, manual: st.manual, base: !!s.baseText });
      new Notice(`Сохранено: ${s.group.name}`);
    } catch (e) {
      new Notice(`Ошибка сохранения: ${e.message}`);
      return;
    }
    await this.afterResolve(s.group);
  }

  /** Действие над конфликтом, открытым в сверке. */
  async runAction(action) {
    const s = this.session;
    if (!s) return;
    await this.runFor(s.group, s.copy, action, true);
  }

  async runFor(group, copy, action, fromMerge = false) {
    const a = this.core.actions;
    try {
      if (action === 'keep') {
        if (!fromMerge || !this.session || this.session.stats().total === 0 || !this.session.hasManualDecisions()) {
          await a.keepCurrent(group, copy);
        } else {
          const ok = await confirm(this.app, { title: 'Оставить текущую?', text: 'Решения по блокам будут потеряны, копия уйдёт в корзину.', confirm: 'Оставить текущую' });
          if (!ok) return;
          await a.keepCurrent(group, copy);
        }
      } else if (action === 'take') {
        const ok = await confirm(this.app, {
          title: group.exists ? 'Взять копию целиком?' : 'Восстановить из копии?',
          text: group.exists
            ? `Содержимое «${group.name}» заменится версией с устройства ${this.core.deviceName(copy.device)}.`
            : `Файл «${group.name}» будет восстановлен из копии.`,
          confirm: group.exists ? 'Заменить' : 'Восстановить',
        });
        if (!ok) return;
        await a.takeCopy(group, copy);
      } else if (action === 'both') {
        const target = await a.keepBoth(group, copy);
        new Notice(`Копия сохранена как ${target}`);
      } else if (action === 'identical') {
        await a.removeIdentical(group, copy);
      }
      if (action !== 'both') new Notice(`${ACTION_TEXT[action]}: ${group.name}`);
    } catch (e) {
      new Notice(`Ошибка: ${e.message}`);
      return;
    }
    this.listState.selected.delete(`${group.source.id}::${copy.path}`);
    if (fromMerge) await this.afterResolve(group);
    else await this.core.rescan();
  }

  /** После решения: следующая копия того же файла или возврат к списку. */
  async afterResolve(group) {
    await this.core.rescan();
    const fresh = this.core.scan && this.core.scan.groups.find((g) => g.id === group.id);
    if (fresh && fresh.copies.length) {
      await this.openMerge(fresh, fresh.copies[0]);
      new Notice(`У файла есть ещё ${fresh.copies.length} ${plural(fresh.copies.length, 'копия', 'копии', 'копий')}`);
      return;
    }
    if (this.session) this.session.dispose();
    this.session = null;
    this.setTab('list');
  }

  async bulk(action, pairs) {
    const labels = { keep: 'Оставить текущие версии', take: 'Взять версии копий', both: 'Сохранить обе версии' };
    const ok = await confirm(this.app, {
      title: `${labels[action]}?`,
      text: `Будет обработано ${pairs.length} ${plural(pairs.length, 'копия', 'копии', 'копий')}.`,
      confirm: 'Выполнить',
      danger: action === 'take',
    });
    if (!ok) return;
    const a = this.core.actions;
    let done = 0;
    // Для «взять копию» по одному файлу берём только самую свежую копию
    const seen = new Set();
    for (const [g, c] of pairs) {
      try {
        if (action === 'keep') await a.keepCurrent(g, c);
        else if (action === 'both') await a.keepBoth(g, c);
        else if (action === 'take') {
          if (seen.has(g.id)) { await a.keepBoth(g, c); } else { seen.add(g.id); await a.takeCopy(g, c); }
        }
        done++;
      } catch (e) {
        new Notice(`${g.name}: ${e.message}`);
      }
    }
    this.listState.selected.clear();
    new Notice(`Готово: ${done} из ${pairs.length}`);
    await this.core.rescan();
  }

  async cleanIdentical() {
    const n = await this.core.cleanIdentical(true);
    if (n !== null) this.rerender();
  }

  removeModeText() {
    const m = this.core.settings.removeMode;
    return m === 'delete' ? 'будут удалены насовсем' : m === 'system' ? 'уйдут в системную корзину' : 'уйдут в корзину Obsidian (.trash)';
  }

  /** Пакетное действие над целой категорией. */
  async runBulk(category, action) {
    const core = this.core;
    if (core.bulk.running) return;
    const n = core.bulk.items(category).length;
    if (!n) return;
    const meta = CATEGORIES[category];
    const act = meta.actions.find((a) => a.id === action);
    const what = {
      remove: `Текущие файлы не меняются, конфликтные копии ${this.removeModeText()}.`,
      take: `Содержимое файлов заменится версиями из копий, копии ${this.removeModeText()}. Если у файла несколько копий, берётся самая свежая.`,
      merge: `Файлы перезапишутся результатом трёхстороннего слияния, копии ${this.removeModeText()}.`,
      restore: 'Копии переименуются обратно в исходные имена (самая свежая копия для каждого файла).',
      both: 'Копии останутся рядом с файлами под понятными именами: «имя (устройство дата)».',
    }[action];
    const ok = await confirm(this.app, {
      title: `${meta.label}: ${act.text.toLowerCase()}?`,
      text: `Будет обработано ${n.toLocaleString('ru-RU')} ${plural(n, 'копия', 'копии', 'копий')}. ${what}`,
      confirm: act.text,
      danger: action === 'take' || action === 'merge',
    });
    if (!ok) return;
    const r = await core.bulk.run(category, action);
    this.reportBulk([[meta.label, action, r]]);
    await core.rescan();
  }

  /** Все безопасные категории подряд. */
  async runSafe(plan) {
    const core = this.core;
    if (core.bulk.running) return;
    const todo = plan.filter(([c]) => core.bulk.items(c).length);
    const total = todo.reduce((n, [c]) => n + core.bulk.items(c).length, 0);
    const lines = todo.map(([c, a]) => `• ${CATEGORIES[c].label} — ${core.bulk.items(c).length.toLocaleString('ru-RU')}: ${CATEGORIES[c].actions.find((x) => x.id === a).text.toLowerCase()}`);
    const ok = await confirm(this.app, {
      title: `Разобрать ${total.toLocaleString('ru-RU')} ${plural(total, 'копию', 'копии', 'копий')}?`,
      text: `${lines.join('\n')}\n\nНичего не теряется: в каждом случае остаётся версия, в которой есть всё. Убранные копии ${this.removeModeText()}.`,
      confirm: 'Разобрать',
    });
    if (!ok) return;
    const results = [];
    for (const [c, a] of todo) {
      const r = await core.bulk.run(c, a);
      results.push([CATEGORIES[c].label, a, r]);
      if (r.cancelled) break;
    }
    this.reportBulk(results);
    await core.rescan();
  }

  reportBulk(results) {
    const ok = results.reduce((n, [, , r]) => n + r.ok, 0);
    const failed = results.reduce((n, [, , r]) => n + r.failed, 0);
    const skipped = results.reduce((n, [, , r]) => n + r.skipped, 0);
    const cancelled = results.some(([, , r]) => r.cancelled);
    const parts = [`Готово: ${ok.toLocaleString('ru-RU')}`];
    if (skipped) parts.push(`отложено ${skipped} (у файла несколько копий — пересчитаются)`);
    if (failed) parts.push(`ошибок ${failed}`);
    if (cancelled) parts.push('остановлено');
    new Notice(parts.join(' · '), 8000);
    const errors = results.flatMap(([, , r]) => r.errors);
    if (errors.length) console.warn('[Syncthing Conflict Resolver] ошибки массового разбора:\n' + errors.join('\n'));
  }
}

module.exports = { ConflictView };
