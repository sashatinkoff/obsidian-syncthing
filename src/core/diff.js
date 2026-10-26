'use strict';
/**
 * Построчный и пословный diff (алгоритм Майерса, O(ND)).
 * Модуль без зависимостей от Obsidian — его можно тестировать в Node.
 */

const MAX_EDIT_DISTANCE = 6000;

/**
 * Ядро Майерса: возвращает массив операций для элементов a и b:
 * 'e' — равны, 'd' — удалено из a, 'i' — вставлено из b.
 */
function myersCore(a, b) {
  const n = a.length;
  const m = b.length;
  if (n === 0) return new Array(m).fill('i');
  if (m === 0) return new Array(n).fill('d');

  const max = n + m;
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];

  for (let d = 0; d <= max; d++) {
    if (d > MAX_EDIT_DISTANCE) {
      // Слишком разные тексты — отдаём «всё заменено», чтобы не повесить интерфейс
      return new Array(n).fill('d').concat(new Array(m).fill('i'));
    }
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x;
      if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
        x = v[offset + k + 1];
      } else {
        x = v[offset + k - 1] + 1;
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[offset + k] = x;
      if (x >= n && y >= m) return backtrack(trace, n, m, offset);
    }
  }
  return [];
}

function backtrack(trace, n, m, offset) {
  const ops = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    let prevK;
    if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) prevK = k + 1;
    else prevK = k - 1;
    const prevX = v[offset + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { ops.push('e'); x--; y--; }
    if (d > 0) ops.push(x === prevX ? 'i' : 'd');
    x = prevX;
    y = prevY;
  }
  return ops.reverse();
}

/** Операции с отрезанием общего начала и конца (сильно ускоряет типичные случаи). */
function editScript(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const middle = myersCore(a.slice(start, endA), b.slice(start, endB));
  const ops = new Array(start).fill('e');
  for (const op of middle) ops.push(op);
  for (let i = endA; i < a.length; i++) ops.push('e');
  return ops;
}

/**
 * Ханки различий: [{ aStart, aEnd, bStart, bEnd }] — полуоткрытые диапазоны.
 */
function diffHunks(a, b) {
  const ops = editScript(a, b);
  const hunks = [];
  let i = 0;
  let j = 0;
  let cur = null;
  for (const op of ops) {
    if (op === 'e') {
      if (cur) { hunks.push(cur); cur = null; }
      i++; j++;
    } else {
      if (!cur) cur = { aStart: i, aEnd: i, bStart: j, bEnd: j };
      if (op === 'd') { i++; cur.aEnd = i; } else { j++; cur.bEnd = j; }
    }
  }
  if (cur) hunks.push(cur);
  return hunks;
}

const TOKEN_RE = /\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu;

function tokenize(text) {
  return text.match(TOKEN_RE) || [];
}

/**
 * Склеивает подсветку: пробелы (и одиночные знаки препинания) между двумя изменёнными
 * кусками тоже считаются изменёнными, чтобы переписанная фраза подсвечивалась сплошь.
 */
function glue(segs) {
  const out = [];
  for (let k = 0; k < segs.length; k++) {
    const s = segs[k];
    const prev = out[out.length - 1];
    const next = segs[k + 1];
    const isGap = !s.mark && prev && prev.mark && next && next.mark && /^[\s,.;:—–-]{1,3}$/.test(s.text) && !s.text.includes('\n');
    if (isGap || (prev && prev.mark && s.mark)) { prev.text += s.text; continue; }
    out.push({ text: s.text, mark: s.mark });
  }
  return out;
}

/**
 * Пословная разметка двух фрагментов.
 * Возвращает { left: [{text, mark}], right: [{text, mark}] } или null, если фрагменты слишком большие.
 */
function wordDiff(leftText, rightText) {
  const a = tokenize(leftText);
  const b = tokenize(rightText);
  if (a.length + b.length > 6000) return null;
  const ops = editScript(a, b);
  const left = [];
  const right = [];
  let i = 0;
  let j = 0;
  const push = (arr, text, mark) => {
    const last = arr[arr.length - 1];
    if (last && last.mark === mark) last.text += text;
    else arr.push({ text, mark });
  };
  for (const op of ops) {
    if (op === 'e') { push(left, a[i++], false); push(right, b[j++], false); }
    else if (op === 'd') push(left, a[i++], true);
    else push(right, b[j++], true);
  }
  return { left: glue(left), right: glue(right) };
}

module.exports = { editScript, diffHunks, wordDiff, tokenize };
