'use strict';
/**
 * Поиск конфликтов Syncthing и версий-кандидатов в базу из .stversions.
 */

const { CONFLICT_RE, VERSION_RE } = require('../constants');
const { basename, dirname, joinPath, parseStamp, fileKind, sameBuffers } = require('../util');

function parseConflict(path) {
  const name = basename(path);
  const m = CONFLICT_RE.exec(name);
  if (!m) return null;
  const original = joinPath(dirname(path), m[1] + (m[5] || ''));
  return { path, original, time: parseStamp(m[2], m[3]), device: m[4] };
}

function isConflictPath(path) {
  return CONFLICT_RE.test(basename(path));
}

function isExcluded(path, excluded) {
  return excluded.some((x) => {
    const f = x.replace(/^\/+|\/+$/g, '');
    return f && (path === f || path.startsWith(`${f}/`));
  });
}

/** Индекс версий: ключ (путь относительно папки Syncthing) → [{ source, path, time }] по убыванию времени. */
async function buildVersionIndex(location) {
  const index = new Map();
  if (!location) return index;
  const { source, dir } = location;
  let files = [];
  try { files = await source.listRecursive(dir); } catch (e) { return index; }
  const prefix = dir ? `${dir}/` : '';
  for (const p of files) {
    const rel = p.startsWith(prefix) ? p.slice(prefix.length) : p;
    const m = VERSION_RE.exec(basename(rel));
    if (!m) continue;
    const key = joinPath(dirname(rel), m[1] + (m[4] || ''));
    if (!index.has(key)) index.set(key, []);
    index.get(key).push({ source, path: p, time: parseStamp(m[2], m[3]) });
  }
  for (const list of index.values()) list.sort((a, b) => b.time - a.time);
  return index;
}

/* ---------- переименованные файлы ---------- */

/** Имя без расширения, приведённое к «скелету»: регистр, Юникод, разделители (пробел, _, -, .) не важны. */
function nameKey(path) {
  const b = basename(path);
  const i = b.lastIndexOf('.');
  const stem = (i > 0 ? b.slice(0, i) : b).normalize('NFC').toLowerCase();
  const ext = i > 0 ? b.slice(i).toLowerCase() : '';
  return stem.replace(/[\s_\-.,()]+/g, '') + ext;
}

/**
 * Исходного файла нет — возможно, его переименовали (Syncthing видит переименование как удаление + создание,
 * а правка старого имени на другом устройстве превращается в конфликтную копию).
 * Ищем файл с тем же «скелетом» имени: сначала в той же папке, потом где угодно.
 */
function findRenamed(original, index) {
  const list = index.get(nameKey(original));
  if (!list || !list.length) return null;
  const dir = dirname(original);
  return list.find((p) => dirname(p) === dir) || (list.length === 1 ? list[0] : null);
}

/** Привязать группу к найденному новому имени: дальше всё сравнивается с ним. */
async function attachRenamed(group, target, how) {
  const st = await group.source.stat(target);
  group.renamedFrom = group.path;
  group.renamedHow = how;
  group.path = target;
  group.name = basename(target);
  group.exists = true;
  group.size = st ? st.size : null;
  group.mtime = st ? st.mtime : null;
}

/**
 * Сканирование одного источника.
 * @returns {Promise<{groups: Array, status: {id,label,kind,root,ok,error,files,conflicts,ms}}>}
 */
async function scanSource(plugin, source) {
  const settings = plugin.settings;
  const started = Date.now();
  const status = { id: source.id, label: source.label, kind: source.kind, root: source.root || '', ok: true, error: null, files: 0, conflicts: 0, ms: 0 };
  const groups = [];

  if (source.check) {
    const c = await source.check();
    if (!c.ok) {
      status.ok = false;
      status.error = c.error;
      status.ms = Date.now() - started;
      return { groups, status };
    }
  }

  let paths = [];
  try {
    paths = source.kind === 'vault' ? await source.listAll() : await source.listAll(settings.excludedFolders);
  } catch (e) {
    status.ok = false;
    status.error = e.message;
    status.ms = Date.now() - started;
    return { groups, status };
  }
  status.files = paths.length;

  const byOriginal = new Map();
  for (const p of paths) {
    if (source.kind === 'vault' && isExcluded(p, settings.excludedFolders)) continue;
    const c = parseConflict(p);
    if (!c) continue;
    if (!byOriginal.has(c.original)) byOriginal.set(c.original, []);
    byOriginal.get(c.original).push(c);
  }

  if (byOriginal.size) {
    // Индекс «скелетов» имён существующих файлов — для поиска переименованных
    const nameIndex = new Map();
    for (const p of paths) {
      if (CONFLICT_RE.test(basename(p))) continue;
      if (source.kind === 'vault' && isExcluded(p, settings.excludedFolders)) continue;
      const k = nameKey(p);
      if (!nameIndex.has(k)) nameIndex.set(k, []);
      nameIndex.get(k).push(p);
    }

    let versions = new Map();
    try {
      const loc = source.kind === 'vault' ? source.versionsLocation() : source.versionsLocation(source.versionsPath);
      versions = await buildVersionIndex(loc);
    } catch (e) {
      status.error = `версии недоступны (${e.message})`;
    }

    for (const [original, copies] of byOriginal) {
      copies.sort((a, b) => b.time - a.time);
      const exists = await source.exists(original);
      const stat = exists ? await source.stat(original) : null;
      for (const c of copies) {
        const s = await source.stat(c.path);
        c.size = s ? s.size : null;
        c.mtime = s ? s.mtime : null;
        c.identical = null;
      }
      status.conflicts += copies.length;
      const group = {
        id: `${source.id}::${original}`,
        source,
        path: original,
        name: basename(original),
        exists,
        size: stat ? stat.size : null,
        mtime: stat ? stat.mtime : null,
        kind: fileKind(original),
        copies,
        versions: versions.get(source.syncKey(original)) || [],
        renamedFrom: null,
      };
      if (!exists) {
        const target = findRenamed(original, nameIndex);
        if (target) await attachRenamed(group, target, 'name');
      }
      groups.push(group);
    }
  }
  status.ms = Date.now() - started;
  return { groups, status };
}

/**
 * Полное сканирование всех источников.
 * @returns {Promise<{groups: Array, sources: Array, scannedAt: number, errors: string[]}>}
 */
async function scanAll(plugin) {
  const groups = [];
  const sources = [];
  const errors = [];
  for (const source of plugin.getSources()) {
    const r = await scanSource(plugin, source);
    groups.push(...r.groups);
    sources.push(r.status);
    if (!r.status.ok) errors.push(`${source.label}: ${r.status.error}`);
  }
  groups.sort((a, b) => (b.copies[0].time - a.copies[0].time));
  return { groups, sources, scannedAt: Date.now(), errors };
}

/** Проверка «копия идентична текущему файлу». */
async function checkIdentical(group, copy) {
  if (!group.exists) { copy.identical = false; return false; }
  try {
    if (group.size !== null && copy.size !== null && group.kind !== 'text' && group.size !== copy.size) {
      copy.identical = false;
      return false;
    }
    if (group.kind === 'text') {
      const [a, b] = await Promise.all([group.source.read(group.path), group.source.read(copy.path)]);
      copy.identical = a === b || a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
    } else {
      const [a, b] = await Promise.all([group.source.readBinary(group.path), group.source.readBinary(copy.path)]);
      copy.identical = sameBuffers(a, b);
    }
  } catch (e) {
    copy.identical = false;
  }
  return copy.identical;
}

/**
 * Автовыбор базы: самая свежая версия, заархивированная до момента конфликта.
 * Это эвристика — версия могла быть заменена уже одной из сторон, поэтому интерфейс
 * предупреждает, если база совпадает с левой или правой версией.
 */
function pickBase(group, copy) {
  const limit = copy.time.getTime();
  return group.versions.find((v) => v.time.getTime() <= limit) || null;
}

module.exports = { scanAll, scanSource, checkIdentical, pickBase, parseConflict, isConflictPath, nameKey, findRenamed, attachRenamed };
