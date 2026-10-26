'use strict';
/**
 * Модель слияния: список блоков (chunks).
 *   stable — одинаковые строки во всех версиях: { type:'stable', lines }
 *   change — отличие: { type:'change', id, section, label, base, left, right, auto, decision, custom }
 *
 * left  — текущий файл (тот, что остался под исходным именем)
 * right — конфликтная копия (*.sync-conflict-*)
 * base  — общий предок из .stversions (может отсутствовать → двустороннее сравнение)
 *
 * Решения (decision): 'left' | 'right' | 'both-lr' | 'both-rl' | 'base' | 'custom' | null (не решено)
 */

const { diffHunks } = require('./diff');

const DECISIONS = ['left', 'right', 'both-lr', 'both-rl', 'base', 'custom'];

function splitText(text) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  return { lines: text.split(/\r?\n/), eol };
}

function makeNormalizer(opts) {
  if (opts && opts.ignoreTrailingWhitespace) return (s) => s.replace(/[ \t]+$/, '');
  return (s) => s;
}

function sameLines(a, b, norm) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (norm(a[i]) !== norm(b[i])) return false;
  return true;
}

/* ---------- двустороннее и трёхстороннее сравнение строк ---------- */

function twoWay(L, R, norm, section) {
  const chunks = [];
  const hunks = diffHunks(L.map(norm), R.map(norm));
  let pos = 0;
  for (const h of hunks) {
    if (h.aStart > pos) chunks.push(stable(L.slice(pos, h.aStart)));
    chunks.push(change({
      section,
      base: null,
      left: L.slice(h.aStart, h.aEnd),
      right: R.slice(h.bStart, h.bEnd),
      auto: null,
    }));
    pos = h.aEnd;
  }
  if (pos < L.length) chunks.push(stable(L.slice(pos)));
  return chunks;
}

function threeWay(O, A, B, norm, section) {
  const kO = O.map(norm);
  const hA = diffHunks(kO, A.map(norm)).map((h) => ({ side: 'A', oStart: h.aStart, oEnd: h.aEnd, xStart: h.bStart, xEnd: h.bEnd }));
  const hB = diffHunks(kO, B.map(norm)).map((h) => ({ side: 'B', oStart: h.aStart, oEnd: h.aEnd, xStart: h.bStart, xEnd: h.bEnd }));
  const all = hA.concat(hB).sort((x, y) => x.oStart - y.oStart || x.oEnd - y.oEnd);

  const chunks = [];
  let oPos = 0;
  let delta = 0; // смещение индексов A относительно O в стабильных областях
  let i = 0;

  const range = (group, side, oStart, oEnd) => {
    const s = group.filter((h) => h.side === side);
    if (!s.length) return null;
    const f = s[0];
    const l = s[s.length - 1];
    return [f.xStart - (f.oStart - oStart), l.xEnd + (oEnd - l.oEnd)];
  };

  while (i < all.length) {
    const group = [all[i]];
    let oStart = all[i].oStart;
    let oEnd = all[i].oEnd;
    i++;
    while (i < all.length && all[i].oStart <= oEnd) {
      group.push(all[i]);
      oEnd = Math.max(oEnd, all[i].oEnd);
      i++;
    }
    if (oStart > oPos) chunks.push(stable(A.slice(oPos + delta, oStart + delta)));

    const aR = range(group, 'A', oStart, oEnd);
    const bR = range(group, 'B', oStart, oEnd);
    const baseLines = O.slice(oStart, oEnd);
    const left = aR ? A.slice(aR[0], aR[1]) : A.slice(oStart + delta, oEnd + delta);
    const right = bR ? B.slice(bR[0], bR[1]) : baseLines.slice();

    let auto = null;
    if (!aR) auto = 'right';
    else if (!bR) auto = 'left';
    else if (sameLines(left, right, norm)) auto = 'same';

    chunks.push(change({ section, base: baseLines, left, right, auto }));
    delta += left.length - (oEnd - oStart);
    oPos = oEnd;
  }
  if (oPos < O.length) chunks.push(stable(A.slice(oPos + delta)));
  return chunks;
}

/* ---------- свойства (frontmatter) — слияние по ключам ---------- */

function splitFrontmatter(lines) {
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '...') {
      return { fm: lines.slice(1, i), close: lines[i], body: lines.slice(i + 1) };
    }
  }
  return null;
}

const KEY_RE = /^([^\s#\-][^:]*):(\s|$)/;

function fmEntries(fmLines) {
  const entries = [];
  let cur = null;
  fmLines.forEach((line, idx) => {
    const m = KEY_RE.exec(line);
    if (m) {
      cur = { key: m[1].trim(), lines: [line] };
      entries.push(cur);
    } else if (cur) {
      cur.lines.push(line);
    } else {
      entries.push({ key: `#${idx}`, lines: [line] });
    }
  });
  return entries;
}

function mergeProps(baseFm, leftFm, rightFm, norm) {
  const lE = fmEntries(leftFm);
  const rE = fmEntries(rightFm);
  const bMap = baseFm ? new Map(fmEntries(baseFm).map((e) => [e.key, e.lines])) : null;
  const lMap = new Map(lE.map((e) => [e.key, e.lines]));
  const rMap = new Map(rE.map((e) => [e.key, e.lines]));

  const order = lE.map((e) => e.key);
  for (const e of rE) if (!lMap.has(e.key)) order.push(e.key);

  const chunks = [];
  for (const key of order) {
    const l = lMap.get(key) || null;
    const r = rMap.get(key) || null;
    if ((l === null && r === null) || (l && r && sameLines(l, r, norm))) {
      if (l) chunks.push(stable(l));
      continue;
    }
    let auto = null;
    let b = null;
    if (bMap) {
      b = bMap.get(key) || null;
      const eq = (x, y) => (x === null && y === null) || (x !== null && y !== null && sameLines(x, y, norm));
      if (eq(l, b)) auto = 'right';
      else if (eq(r, b)) auto = 'left';
    }
    chunks.push(change({
      section: 'props',
      label: key.startsWith('#') ? 'строка свойств' : key,
      base: bMap ? (b || []) : null,
      left: l || [],
      right: r || [],
      auto,
    }));
  }
  return chunks;
}

/* ---------- сборка модели ---------- */

let seq = 0;
function stable(lines) { return { type: 'stable', lines }; }
function change(c) {
  const decision = c.auto === 'same' ? 'left' : c.auto;
  return {
    type: 'change',
    id: `c${++seq}`,
    section: c.section || 'body',
    label: c.label || null,
    base: c.base,
    left: c.left,
    right: c.right,
    auto: c.auto,
    decision: decision || null,
    custom: null,
  };
}

function compact(chunks) {
  const out = [];
  for (const ch of chunks) {
    const last = out[out.length - 1];
    if (ch.type === 'stable') {
      if (!ch.lines.length) continue;
      if (last && last.type === 'stable') { last.lines = last.lines.concat(ch.lines); continue; }
    }
    out.push(ch);
  }
  return out;
}

/**
 * @param {{left:string, right:string, base?:string|null, ignoreTrailingWhitespace?:boolean, mergeProperties?:boolean}} input
 */
function buildModel(input) {
  const norm = makeNormalizer(input);
  const L = splitText(input.left);
  const R = splitText(input.right);
  const hasBase = typeof input.base === 'string';
  const O = hasBase ? splitText(input.base) : null;

  let chunks;
  const fL = splitFrontmatter(L.lines);
  const fR = splitFrontmatter(R.lines);
  if (input.mergeProperties !== false && fL && fR) {
    const fO = hasBase ? splitFrontmatter(O.lines) : null;
    const baseFm = hasBase ? (fO ? fO.fm : []) : null;
    const baseBody = hasBase ? (fO ? fO.body : O.lines) : null;
    chunks = [stable(['---'])]
      .concat(mergeProps(baseFm, fL.fm, fR.fm, norm))
      .concat([stable([fL.close])])
      .concat(hasBase ? threeWay(baseBody, fL.body, fR.body, norm, 'body') : twoWay(fL.body, fR.body, norm, 'body'));
  } else {
    chunks = hasBase ? threeWay(O.lines, L.lines, R.lines, norm, 'body') : twoWay(L.lines, R.lines, norm, 'body');
  }

  return {
    chunks: compact(chunks),
    eol: L.eol,
    hasBase,
  };
}

function resultLines(ch) {
  if (ch.type === 'stable') return ch.lines;
  switch (ch.decision) {
    case 'left': return ch.left;
    case 'right': return ch.right;
    case 'both-lr': return ch.left.concat(ch.right);
    case 'both-rl': return ch.right.concat(ch.left);
    case 'base': return ch.base || [];
    case 'custom': return ch.custom || [];
    default: return null;
  }
}

function stats(model) {
  let total = 0;
  let auto = 0;
  let unresolved = 0;
  let manual = 0;
  for (const ch of model.chunks) {
    if (ch.type !== 'change') continue;
    total++;
    if (ch.decision === null) unresolved++;
    else if (ch.auto && ch.decision === (ch.auto === 'same' ? 'left' : ch.auto)) auto++;
    else manual++;
  }
  return { total, auto, unresolved, manual };
}

/** Итоговый текст или null, если остались нерешённые блоки. */
function assemble(model) {
  const out = [];
  for (const ch of model.chunks) {
    const lines = resultLines(ch);
    if (lines === null) return null;
    for (const l of lines) out.push(l);
  }
  return out.join(model.eol);
}

module.exports = { buildModel, resultLines, assemble, stats, splitText, DECISIONS };
