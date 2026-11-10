'use strict';
/**
 * REST API Syncthing — только чтобы подтянуть человеческие имена устройств.
 * Работает и на десктопе, и на Android (Syncthing-Fork слушает 127.0.0.1:8384).
 */

const { requestUrl } = require('obsidian');

async function fetchDeviceNames(settings) {
  const base = (settings.apiUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Не указан адрес Syncthing');
  if (!settings.apiKey) throw new Error('Не указан API-ключ (Syncthing → Действия → Настройки → Общие)');
  const res = await requestUrl({
    url: `${base}/rest/config/devices`,
    method: 'GET',
    headers: { 'X-API-Key': settings.apiKey },
    throw: false,
  });
  if (res.status === 403 || res.status === 401) throw new Error('Неверный API-ключ');
  if (res.status !== 200) throw new Error(`Syncthing ответил ${res.status}`);
  const list = res.json;
  const names = {};
  for (const d of list || []) {
    if (!d.deviceID) continue;
    const short = d.deviceID.replace(/-/g, '').slice(0, 7).toUpperCase();
    names[short] = d.name || short;
  }
  return names;
}

/**
 * Папки Syncthing этого устройства: [{ id, label, path, versioning, versionsPath }].
 * Путь к версиям: свой fsPath из настроек версионирования или .stversions внутри папки.
 */
async function fetchFolders(settings) {
  const base = (settings.apiUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Не указан адрес Syncthing');
  if (!settings.apiKey) throw new Error('Укажите API-ключ в разделе «Устройства» (Syncthing → Действия → Настройки → Общие → Ключ API)');
  const res = await requestUrl({
    url: `${base}/rest/config/folders`,
    method: 'GET',
    headers: { 'X-API-Key': settings.apiKey },
    throw: false,
  });
  if (res.status === 403 || res.status === 401) throw new Error('Неверный API-ключ');
  if (res.status !== 200) throw new Error(`Syncthing ответил ${res.status}`);
  return (res.json || []).filter((f) => f && f.path).map((f) => {
    const v = f.versioning || {};
    const hasVersions = !!(v.type && v.type !== 'none' && v.type !== '');
    const fsPath = v.fsPath || (v.params && v.params.fsPath) || '';
    return {
      id: f.id,
      label: f.label || f.id,
      path: f.path,
      versioning: hasVersions,
      versionsPath: fsPath || '.stversions',
    };
  });
}

module.exports = { fetchDeviceNames, fetchFolders };
