'use strict';

const { PluginSettingTab, Setting, Notice, Platform, MarkdownRenderer, TFolder, AbstractInputSuggest } = require('obsidian');
const { fetchDeviceNames } = require('./io/syncthing-api');
const { pickFolder, deviceFoldersSupport } = require('./io/sources');
const { plural } = require('./util');

/** Автодополнение папок хранилища (включая скрытые .stversions и .trash, если они есть). */
const FolderSuggest = AbstractInputSuggest
  ? class extends AbstractInputSuggest {
    constructor(app, inputEl, extra) {
      super(app, inputEl);
      this.inputEl = inputEl;
      this.extra = extra || [];
    }
    getSuggestions(q) {
      const query = q.toLowerCase();
      const folders = this.app.vault.getAllLoadedFiles()
        .filter((f) => f instanceof TFolder && f.path !== '/')
        .map((f) => f.path);
      return this.extra.concat(folders).filter((p) => p.toLowerCase().includes(query)).slice(0, 60);
    }
    renderSuggestion(p, el) { el.setText(p); }
    selectSuggestion(p) {
      this.setValue(p);
      this.inputEl.dispatchEvent(new Event('input'));
      this.close();
    }
  }
  : null;

function attachSuggest(app, input, extra) {
  if (FolderSuggest) new FolderSuggest(app, input, extra);
}

class SettingsTab extends PluginSettingTab {
  constructor(core) {
    super(core.app, core.host);
    this.core = core;
  }

  display() {
    const { containerEl } = this;
    const core = this.core;
    const s = core.settings;
    const save = () => core.saveSettings();
    containerEl.empty();
    containerEl.addClass('scr-settings');

    /* ---------- README ---------- */
    const readme = containerEl.createEl('details', { cls: 'scr-readme' });
    readme.createEl('summary', { text: 'Как пользоваться (README)' });
    const rbody = readme.createDiv('scr-readme-body markdown-rendered');
    core.readReadme().then((md) => {
      if (!md) { rbody.setText('README.md не найден в папке плагина.'); return; }
      MarkdownRenderer.render(this.app, md, rbody, '', core.host);
    });

    /* ---------- сканирование ---------- */
    new Setting(containerEl).setName('Поиск конфликтов').setHeading();

    new Setting(containerEl)
      .setName('Проверять папку настроек')
      .setDesc(`Конфликты в ${this.app.vault.configDir} (workspace.json, data.json плагинов) тоже попадут в список.`)
      .addToggle((t) => t.setValue(s.scanConfigDir).onChange(async (v) => { s.scanConfigDir = v; await save(); }));

    new Setting(containerEl)
      .setName('Следить за появлением конфликтов')
      .setDesc('Перепроверять список, когда Syncthing создаёт или удаляет файлы .sync-conflict.')
      .addToggle((t) => t.setValue(s.autoScan).onChange(async (v) => { s.autoScan = v; await save(); }));

    new Setting(containerEl)
      .setName('Уведомлять о новых конфликтах')
      .addToggle((t) => t.setValue(s.notifyNew).onChange(async (v) => { s.notifyNew = v; await save(); }));

    const ex = new Setting(containerEl)
      .setName('Исключённые папки')
      .setDesc('Конфликты в этих папках не показываются.');
    const exList = containerEl.createDiv('scr-set-list');
    const renderEx = () => {
      exList.empty();
      s.excludedFolders.forEach((f, i) => {
        new Setting(exList).setName(f || '(пусто)').addExtraButton((b) => b.setIcon('x').setTooltip('Убрать').onClick(async () => {
          s.excludedFolders.splice(i, 1);
          await save();
          renderEx();
        }));
      });
    };
    let exInput;
    ex.addText((t) => {
      exInput = t;
      t.setPlaceholder('папка/подпапка');
      attachSuggest(this.app, t.inputEl, ['.trash']);
    });
    ex.addButton((b) => b.setButtonText('Добавить').onClick(async () => {
      const v = (exInput.getValue() || '').trim().replace(/^\/+|\/+$/g, '');
      if (!v || s.excludedFolders.includes(v)) return;
      s.excludedFolders.push(v);
      exInput.setValue('');
      await save();
      renderEx();
    }));
    renderEx();

    /* ---------- версии ---------- */
    new Setting(containerEl).setName('База для автослияния (.stversions)').setHeading();
    containerEl.createDiv({
      cls: 'setting-item-description scr-set-note',
      text: 'Если у папки в Syncthing включено версионирование, плагин ищет там версию, существовавшую до конфликта, и сливает непересекающиеся правки автоматически.',
    });

    new Setting(containerEl)
      .setName('Папка версий')
      .setDesc(Platform.isDesktopApp
        ? 'Путь внутри хранилища (обычно .stversions) или абсолютный путь на диске.'
        : 'Путь внутри хранилища (обычно .stversions). На телефоне — только внутри хранилища.')
      .addText((t) => {
        t.setPlaceholder('.stversions').setValue(s.versionsPath).onChange(async (v) => { s.versionsPath = v.trim(); await save(); });
        attachSuggest(this.app, t.inputEl, ['.stversions']);
      });

    new Setting(containerEl)
      .setName('Хранилище внутри папки Syncthing')
      .setDesc('Если синхронизируется папка выше хранилища — укажите путь хранилища внутри неё (например, Notes/Vault). Обычно пусто.')
      .addText((t) => t.setPlaceholder('').setValue(s.vaultSubpath).onChange(async (v) => { s.vaultSubpath = v.trim().replace(/^\/+|\/+$/g, ''); await save(); }));

    new Setting(containerEl)
      .setName('Подбирать базу автоматически')
      .setDesc('При открытии сверки брать самую свежую версию до момента конфликта.')
      .addToggle((t) => t.setValue(s.autoBase).onChange(async (v) => { s.autoBase = v; await save(); }));

    /* ---------- сверка ---------- */
    new Setting(containerEl).setName('Сверка').setHeading();

    new Setting(containerEl)
      .setName('Строк контекста')
      .setDesc('Сколько неизменённых строк показывать вокруг отличий; остальное сворачивается.')
      .addSlider((sl) => sl.setLimits(0, 12, 1).setValue(s.contextLines).setDynamicTooltip().onChange(async (v) => { s.contextLines = v; await save(); }));

    new Setting(containerEl)
      .setName('Сливать свойства по ключам')
      .setDesc('Frontmatter сравнивается по каждому свойству отдельно: разные правки в tags и в date не конфликтуют.')
      .addToggle((t) => t.setValue(s.mergeProperties).onChange(async (v) => { s.mergeProperties = v; await save(); }));

    new Setting(containerEl)
      .setName('Не различать пробелы в конце строк')
      .addToggle((t) => t.setValue(s.ignoreTrailingWhitespace).onChange(async (v) => { s.ignoreTrailingWhitespace = v; await save(); }));

    new Setting(containerEl)
      .setName('Куда девать конфликтную копию')
      .addDropdown((d) => d
        .addOption('local', 'Корзина Obsidian (.trash)')
        .addOption('system', 'Системная корзина')
        .addOption('delete', 'Удалять насовсем')
        .setValue(s.removeMode)
        .onChange(async (v) => { s.removeMode = v; await save(); }));

    /* ---------- устройства ---------- */
    new Setting(containerEl).setName('Устройства').setHeading();
    containerEl.createDiv({
      cls: 'setting-item-description scr-set-note',
      text: 'В имени конфликтной копии Syncthing пишет первые 7 символов ID устройства. Здесь им можно дать понятные имена — вручную или из Syncthing.',
    });

    new Setting(containerEl)
      .setName('Адрес Syncthing')
      .setDesc('Веб-интерфейс Syncthing на этом устройстве. На Android (Syncthing-Fork) — тоже 127.0.0.1:8384.')
      .addText((t) => t.setPlaceholder('http://127.0.0.1:8384').setValue(s.apiUrl).onChange(async (v) => { s.apiUrl = v.trim(); await save(); }));

    new Setting(containerEl)
      .setName('API-ключ')
      .setDesc('Syncthing → Действия → Настройки → Общие → Ключ API.')
      .addText((t) => {
        t.inputEl.type = 'password';
        t.setValue(s.apiKey).onChange(async (v) => { s.apiKey = v.trim(); await save(); });
      })
      .addButton((b) => b.setButtonText('Загрузить имена').setCta().onClick(async () => {
        try {
          const names = await fetchDeviceNames(s);
          s.deviceNames = Object.assign({}, s.deviceNames, names);
          await save();
          new Notice(`Получено устройств: ${Object.keys(names).length}`);
          this.display();
        } catch (e) {
          new Notice(`Syncthing: ${e.message}`);
        }
      }));

    const ids = new Set(Object.keys(s.deviceNames));
    if (core.scan) for (const g of core.scan.groups) for (const c of g.copies) ids.add(c.device);
    const devBox = containerEl.createDiv('scr-set-list');
    if (!ids.size) devBox.createDiv({ cls: 'setting-item-description', text: 'Устройства появятся после первого конфликта или загрузки имён.' });
    for (const id of [...ids].sort()) {
      new Setting(devBox)
        .setName(id)
        .addText((t) => t.setPlaceholder('Имя устройства').setValue(s.deviceNames[id] || '').onChange(async (v) => {
          if (v.trim()) s.deviceNames[id] = v.trim();
          else delete s.deviceNames[id];
          await save();
        }));
    }

    /* ---------- статистика ---------- */
    new Setting(containerEl).setName('Статистика').setHeading();
    new Setting(containerEl)
      .setName('Заметка с отчётом')
      .setDesc('Куда сохранять отчёт по команде «Сохранить отчёт статистики в заметку» или кнопке на вкладке «Статистика».')
      .addText((t) => {
        t.setPlaceholder('Syncthing/Статистика конфликтов.md').setValue(s.statsNotePath).onChange(async (v) => { s.statsNotePath = v.trim(); await save(); });
      });

    this.renderFolders(containerEl);
  }

  /* ---------- папки на этом устройстве ---------- */
  renderFolders(containerEl) {
    const core = this.core;
    const s = core.settings;
    const save = () => core.saveSettings();
    const me = core.localDeviceId();
    const support = deviceFoldersSupport(this.app);

    new Setting(containerEl).setName('Папки на этом устройстве').setHeading();

    if (!support) {
      containerEl.createDiv({
        cls: 'setting-item-description scr-set-note',
        text: Platform.isIosApp
          ? 'На iPhone и iPad Obsidian видит только хранилище — так устроена iOS. Чтобы разобрать конфликты другой папки, откройте её как отдельное хранилище и включите в нём этот плагин (папку .obsidian добавьте в .stignore).'
          : 'На этом устройстве Obsidian не даёт доступа к папкам вне хранилища. Откройте нужную папку как отдельное хранилище и включите в нём этот плагин.',
      });
    } else {
      containerEl.createDiv({
        cls: 'setting-item-description scr-set-note',
        text: support === 'android'
          ? 'Любые папки Syncthing в памяти телефона, например /storage/emulated/0/Syncthing/Документы. Нужен доступ Obsidian ко всем файлам (Настройки Android → Приложения → Obsidian → Разрешения). Режим экспериментальный — проверьте доступ кнопкой «Проверить».'
          : 'Любые папки Syncthing на этом компьютере. Каждое устройство хранит свой список: папки, добавленные здесь, не появятся на телефоне.',
      });
    }

    new Setting(containerEl)
      .setName('Имя этого устройства')
      .setDesc('Чтобы в списке было видно, на каком устройстве настроена папка.')
      .addText((t) => {
        const KEY = 'scr-device-label';
        let cur = '';
        try { cur = (this.app.loadLocalStorage ? this.app.loadLocalStorage(KEY) : window.localStorage.getItem(KEY)) || ''; } catch (e) { cur = ''; }
        t.setPlaceholder(support === 'android' ? 'Телефон' : 'Компьютер').setValue(cur).onChange((v) => {
          try {
            if (this.app.saveLocalStorage) this.app.saveLocalStorage(KEY, v.trim());
            else window.localStorage.setItem(KEY, v.trim());
          } catch (e) { /* ignore */ }
          for (const f of s.externalFolders) if (f.deviceId === me) f.deviceLabel = v.trim();
          save();
        });
      });

    const mine = core.foldersHere();
    for (const f of mine) {
      const st = new Setting(containerEl)
        .setName(f.label || f.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop())
        .setDesc(f.path);
      st.settingEl.addClass('scr-folder-setting');
      const status = st.descEl.createDiv('scr-folder-status');
      st.addToggle((t) => t.setTooltip('Проверять эту папку').setValue(f.enabled !== false).onChange(async (v) => {
        f.enabled = v;
        await save();
        core.rescan();
      }));
      st.addText((t) => t.setPlaceholder('Название').setValue(f.label || '').onChange(async (v) => { f.label = v.trim(); await save(); }));
      st.addText((t) => {
        t.setPlaceholder('.stversions').setValue(f.versionsPath || '').onChange(async (v) => { f.versionsPath = v.trim(); await save(); });
        t.inputEl.setAttr('title', 'Папка версий Syncthing (относительно папки или абсолютный путь)');
      });
      st.addButton((b) => b.setButtonText('Проверить').onClick(async () => {
        status.setText('Проверяю…');
        status.className = 'scr-folder-status';
        const r = await core.checkFolder(f);
        if (r.ok) {
          status.setText(`Доступ есть · ${r.files} ${plural(r.files, 'файл', 'файла', 'файлов')} · конфликтов: ${r.conflicts}${r.error ? ` · ${r.error}` : ''}`);
          status.addClass(r.conflicts ? 'is-warn' : 'is-ok');
        } else {
          status.setText(r.error);
          status.addClass('is-error');
        }
      }));
      st.addExtraButton((b) => b.setIcon('trash-2').setTooltip('Убрать из списка').onClick(async () => {
        s.externalFolders.splice(s.externalFolders.indexOf(f), 1);
        await save();
        this.display();
        core.rescan();
      }));
    }

    const others = s.externalFolders.filter((f) => f && f.deviceId && f.deviceId !== me);
    if (others.length) {
      const labels = [...new Set(others.map((f) => f.deviceLabel || 'другое устройство'))].join(', ');
      containerEl.createDiv({
        cls: 'setting-item-description scr-set-note',
        text: `Ещё ${others.length} ${others.length === 1 ? 'папка настроена' : 'папки настроены'} на других устройствах (${labels}) — здесь они не проверяются.`,
      });
    }

    if (!support) return;

    let pathInput;
    let checkEl;
    const add = new Setting(containerEl)
      .setName('Добавить папку')
      .addText((t) => {
        pathInput = t;
        t.setPlaceholder(support === 'android' ? '/storage/emulated/0/Syncthing/Документы' : '/Users/me/Sync/Документы');
        t.inputEl.addClass('scr-path-input');
      });
    if (support === 'desktop') {
      add.addButton((b) => b.setButtonText('Выбрать…').onClick(async () => {
        const p = await pickFolder();
        if (p) pathInput.setValue(p);
      }));
    }
    add.addButton((b) => b.setButtonText('Проверить и добавить').setCta().onClick(async () => {
      const p = (pathInput.getValue() || '').trim();
      if (!p) return;
      if (mine.some((f) => f.path === p)) { new Notice('Эта папка уже в списке'); return; }
      const folder = {
        path: p,
        label: p.replace(/[\\/]+$/, '').split(/[\\/]/).pop(),
        versionsPath: '.stversions',
        enabled: true,
        deviceId: me,
        deviceLabel: (() => { try { return (this.app.loadLocalStorage ? this.app.loadLocalStorage('scr-device-label') : window.localStorage.getItem('scr-device-label')) || ''; } catch (e) { return ''; } })(),
      };
      checkEl.setText('Проверяю доступ…');
      const r = await core.checkFolder(folder);
      if (!r.ok) {
        checkEl.setText(`Не добавлено: ${r.error}`);
        checkEl.className = 'scr-folder-status is-error';
        return;
      }
      s.externalFolders.push(folder);
      await save();
      new Notice(`Папка добавлена: ${r.files} ${plural(r.files, 'файл', 'файла', 'файлов')}, конфликтов: ${r.conflicts}`);
      this.display();
      core.rescan();
    }));
    checkEl = add.descEl.createDiv('scr-folder-status');
  }
}

module.exports = { SettingsTab };
