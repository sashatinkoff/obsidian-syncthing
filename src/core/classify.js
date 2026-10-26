'use strict';
/**
 * Классификация конфликта: чем на самом деле отличается копия от текущего файла.
 * Чистая логика без Obsidian — тестируется в Node.
 *
 * Категории (от безопасных к ручным):
 *   identical       копия совпадает байт в байт
 *   whitespace      отличаются только переводы строк, пробелы в концах строк, финальный перевод строки,
 *                   BOM, неразрывные пробелы или форма Юникода (NFC/NFD — частая история macOS ↔ Android)
 *   current-newer   копия — старая версия: в текущем файле всё то же самое плюс дополнения
 *   copy-newer      текущий файл — старая версия: в копии всё то же самое плюс дополнения
 *   props           тексты одинаковые, отличаются только свойства (frontmatter)
 *   auto            трёхстороннее слияние с базой из .stversions прошло без конфликтов
 *   conflict        настоящие встречные правки — нужна сверка
 *   missing         исходного файла нет, осталась только копия
 *   binary          двоичные файлы разные
 */

const { buildModel, assemble, stats } = require('./merge');

const CATEGORY_ORDER = ['identical', 'whitespace', 'current-newer', 'copy-newer', 'props', 'auto', 'missing', 'binary', 'conflict'];

/** Нормализация «невидимых» отличий. */
function normalize(text) {
  let t = text;
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  t = t.normalize('NFC');
  t = t.replace(/\r\n?/g, '\n').replace(/ /g, ' ').replace(/[​‌‍⁠]/g, '');
  t = t.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n');
  return t.replace(/\n+$/, '');
}

function splitFm(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return { fm: '', body: text };
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---' || lines[i] === '...') {
      return { fm: lines.slice(1, i).join('\n'), body: lines.slice(i + 1).join('\n') };
    }
  }
  return { fm: '', body: text };
}

/** Все ли изменения в двустороннем diff — только вставки с одной стороны. */
function onlyAdditions(model) {
  let left = false;
  let right = false;
  for (const ch of model.chunks) {
    if (ch.type !== 'change') continue;
    if (ch.left.length && ch.right.length) return null;
    if (ch.right.length) right = true; // в копии есть строки, которых нет в текущем
    if (ch.left.length) left = true; // в текущем есть строки, которых нет в копии
  }
  if (left && !right) return 'current-newer';
  if (right && !left) return 'copy-newer';
  return null;
}

/**
 * @param {{current: string|null, copy: string, base?: string|null, mergeProperties?: boolean}} input
 * @returns {{category: string, merged?: string, detail?: string}}
 */
function classifyText(input) {
  const { current, copy } = input;
  if (current === null || current === undefined) return { category: 'missing' };
  if (current === copy) return { category: 'identical' };

  const nCur = normalize(current);
  const nCopy = normalize(copy);
  if (nCur === nCopy) return { category: 'whitespace', detail: describeWhitespace(current, copy) };

  // Трёхстороннее слияние, если есть база
  if (typeof input.base === 'string') {
    const nBase = normalize(input.base);
    if (nBase === nCur) return { category: 'copy-newer', detail: 'текущий файл не менялся с базы' };
    if (nBase === nCopy) return { category: 'current-newer', detail: 'копия не менялась с базы' };
    const m = buildModel({ left: nCur, right: nCopy, base: nBase, mergeProperties: input.mergeProperties !== false });
    const st = stats(m);
    if (st.unresolved === 0) {
      return { category: 'auto', merged: restoreEol(assemble(m), current), detail: `слито блоков: ${st.auto}` };
    }
  }

  // Только свойства?
  const fCur = splitFm(nCur);
  const fCopy = splitFm(nCopy);
  if (fCur.body === fCopy.body && fCur.fm !== fCopy.fm) {
    const pm = buildModel({ left: nCur, right: nCopy, mergeProperties: true });
    const keys = pm.chunks.filter((c) => c.type === 'change').map((c) => c.label).filter(Boolean);
    return { category: 'props', detail: keys.length ? keys.join(', ') : 'свойства' };
  }

  // Одна сторона — просто дополненная версия другой
  const m2 = buildModel({ left: nCur, right: nCopy, mergeProperties: false });
  const add = onlyAdditions(m2);
  if (add) return { category: add, detail: add === 'copy-newer' ? 'в копии только добавлены строки' : 'в текущем только добавлены строки' };

  return { category: 'conflict' };
}

function describeWhitespace(a, b) {
  const parts = [];
  if ((a.charCodeAt(0) === 0xfeff) !== (b.charCodeAt(0) === 0xfeff)) parts.push('BOM');
  if (a.includes('\r\n') !== b.includes('\r\n')) parts.push('переводы строк');
  if (a.normalize('NFC') !== a || b.normalize('NFC') !== b) parts.push('Юникод NFC/NFD');
  if (/\n$/.test(a) !== /\n$/.test(b)) parts.push('перевод строки в конце');
  if (!parts.length) parts.push('пробелы');
  return parts.join(', ');
}

/** Сохраняем стиль переводов строк текущего файла. */
function restoreEol(text, like) {
  if (text === null) return null;
  const eol = like.includes('\r\n') ? '\r\n' : '\n';
  let t = eol === '\n' ? text : text.replace(/\n/g, eol);
  if (/\r?\n$/.test(like) && !t.endsWith(eol)) t += eol;
  return t;
}

module.exports = { classifyText, normalize, CATEGORY_ORDER };
