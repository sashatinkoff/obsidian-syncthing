'use strict';

const { setIcon, Modal } = require('obsidian');

function button(parent, opts) {
  const cls = ['scr-btn'];
  if (opts.variant) cls.push(`scr-btn-${opts.variant}`);
  if (opts.cls) cls.push(...[].concat(opts.cls));
  if (opts.icon && !opts.text) cls.push('scr-btn-icon');
  const b = parent.createEl('button', { cls });
  if (opts.icon) setIcon(b.createSpan({ cls: 'scr-btn-ico' }), opts.icon);
  if (opts.text) b.createSpan({ text: opts.text, cls: 'scr-btn-label' });
  if (opts.title) { b.setAttr('aria-label', opts.title); b.setAttr('title', opts.title); }
  if (opts.disabled) b.disabled = true;
  if (opts.onClick) {
    b.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (b.disabled) return;
      b.addClass('is-busy');
      try { await opts.onClick(e); } finally { b.removeClass('is-busy'); }
    });
  }
  return b;
}

function icon(parent, name, cls) {
  const s = parent.createSpan({ cls: ['scr-ico'].concat(cls ? [cls] : []) });
  setIcon(s, name);
  return s;
}

function chip(parent, text, variant, ico) {
  const c = parent.createSpan({ cls: ['scr-chip'].concat(variant ? [`scr-chip-${variant}`] : []) });
  if (ico) icon(c, ico);
  c.createSpan({ text });
  return c;
}

function statCard(parent, { label, value, hint, ico, variant }) {
  const c = parent.createDiv({ cls: ['scr-stat'].concat(variant ? [`scr-stat-${variant}`] : []) });
  const top = c.createDiv('scr-stat-top');
  if (ico) icon(top, ico, 'scr-stat-ico');
  top.createSpan({ text: label, cls: 'scr-stat-label' });
  c.createDiv({ text: String(value), cls: 'scr-stat-value' });
  if (hint) c.createDiv({ text: hint, cls: 'scr-stat-hint' });
  return c;
}

function emptyState(parent, { ico, title, text, action }) {
  const e = parent.createDiv('scr-empty');
  if (ico) icon(e.createDiv('scr-empty-ico'), ico);
  e.createDiv({ text: title, cls: 'scr-empty-title' });
  if (text) e.createDiv({ text, cls: 'scr-empty-text' });
  if (action) button(e.createDiv('scr-empty-actions'), action);
  return e;
}

const AVATAR_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899', '#6366f1'];
function avatar(parent, name, id) {
  let h = 0;
  for (const ch of id || name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = parent.createSpan({ cls: 'scr-avatar' });
  a.style.setProperty('--scr-avatar', AVATAR_COLORS[h % AVATAR_COLORS.length]);
  const initials = name.split(/[\s\-_]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  a.setText(initials || '?');
  return a;
}

class ConfirmModal extends Modal {
  constructor(app, { title, text, confirm, danger }, resolve) {
    super(app);
    this.opts = { title, text, confirm, danger };
    this.resolve = resolve;
    this.done = false;
  }
  onOpen() {
    this.modalEl.addClass('scr-modal');
    this.titleEl.setText(this.opts.title);
    this.contentEl.createDiv({ text: this.opts.text, cls: 'scr-modal-text' });
    const row = this.contentEl.createDiv('scr-modal-actions');
    button(row, { text: 'Отмена', onClick: () => this.close() });
    button(row, {
      text: this.opts.confirm || 'Продолжить',
      variant: this.opts.danger ? 'danger' : 'primary',
      onClick: () => { this.done = true; this.close(); },
    });
  }
  onClose() { this.resolve(this.done); }
}

function confirm(app, opts) {
  return new Promise((resolve) => new ConfirmModal(app, opts, resolve).open());
}

module.exports = { button, icon, chip, statCard, emptyState, avatar, confirm };
