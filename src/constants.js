'use strict';

const VIEW_TYPE = 'syncthing-conflict-resolver-view';
const ICON = 'git-merge';

/** <имя>.sync-conflict-<YYYYMMDD>-<HHMMSS>-<ID устройства, 7 символов>[.<расширение>] */
const CONFLICT_RE = /^(.*)\.sync-conflict-(\d{8})-(\d{6})-([A-Z0-9]{7})(\.[^.]*)?$/;

/** Версии в .stversions: <имя>~<YYYYMMDD>-<HHMMSS>[.<расширение>] */
const VERSION_RE = /^(.*)~(\d{8})-(\d{6})(\.[^.]*)?$/;

const TEXT_EXT = [
  'md', 'markdown', 'txt', 'json', 'canvas', 'css', 'js', 'ts', 'mjs', 'csv', 'tsv', 'yaml', 'yml',
  'html', 'htm', 'xml', 'svg', 'ini', 'conf', 'toml', 'log', 'tex', 'bib', 'org', 'py', 'sh',
];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'heic', 'svg'];

const DEFAULT_SETTINGS = {
  scanConfigDir: true,
  excludedFolders: ['.trash'],
  autoScan: true,
  notifyNew: true,

  versionsPath: '.stversions',
  vaultSubpath: '',

  deviceNames: {},
  apiUrl: 'http://127.0.0.1:8384',
  apiKey: '',

  externalFolders: [], // [{ path, label, versionsPath, enabled, deviceId, deviceLabel }] — у каждого устройства свои

  contextLines: 3,
  ignoreTrailingWhitespace: false,
  mergeProperties: true,
  autoBase: true,

  statsNotePath: 'Syncthing/Статистика конфликтов.md',

  removeMode: 'local', // local — корзина Obsidian (.trash), system — системная, delete — насовсем
  journalLimit: 500,
};

module.exports = { VIEW_TYPE, ICON, CONFLICT_RE, VERSION_RE, TEXT_EXT, IMAGE_EXT, DEFAULT_SETTINGS };
