'use strict';
/**
 * Действия над конфликтом. Каждое пишет запись в журнал.
 */

const { splitExt, fileStamp, joinPath } = require('../util');

async function uniquePath(source, path) {
  if (!(await source.exists(path))) return path;
  const { dir, stem, ext } = splitExt(path);
  for (let i = 2; i < 1000; i++) {
    const p = joinPath(dir, `${stem} ${i}${ext}`);
    if (!(await source.exists(p))) return p;
  }
  return joinPath(dir, `${stem} ${Date.now()}${ext}`);
}

class ConflictActions {
  constructor(plugin) {
    this.plugin = plugin;
  }

  get mode() { return this.plugin.settings.removeMode; }

  log(group, copy, action, extra = {}) {
    this.plugin.journal.add({
      t: Date.now(),
      path: group.path,
      source: group.source.label,
      device: copy.device,
      deviceName: this.plugin.deviceName(copy.device),
      action,
      copyTime: copy.time instanceof Date ? copy.time.getTime() : copy.time,
      kind: group.kind,
      ...extra,
    });
  }

  /** Сохранить результат сверки в исходный файл и убрать копию. */
  async saveMerged(group, copy, text, info) {
    const src = group.source;
    await src.write(group.path, text);
    await src.remove(copy.path, this.mode);
    this.log(group, copy, 'merge', info);
  }

  /** Оставить текущую версию — конфликтная копия уходит в корзину. */
  async keepCurrent(group, copy) {
    await group.source.remove(copy.path, this.mode);
    this.log(group, copy, 'keep');
  }

  /** Взять конфликтную копию целиком. */
  async takeCopy(group, copy) {
    const src = group.source;
    if (!group.exists) {
      await src.rename(copy.path, group.path);
    } else if (group.kind === 'text') {
      const text = await src.read(copy.path);
      await src.write(group.path, text);
      await src.remove(copy.path, this.mode);
    } else {
      const data = await src.readBinary(copy.path);
      await src.writeBinary(group.path, data);
      await src.remove(copy.path, this.mode);
    }
    this.log(group, copy, 'take');
  }

  /** Оставить обе: копия переименовывается в «имя (устройство дата).ext». */
  async keepBoth(group, copy) {
    const { dir, stem, ext } = splitExt(group.path);
    const name = `${stem} (${this.plugin.deviceName(copy.device)} ${fileStamp(copy.time)})${ext}`;
    const target = await uniquePath(group.source, joinPath(dir, name));
    await group.source.rename(copy.path, target);
    this.log(group, copy, 'both', { target });
    return target;
  }

  /** Убрать идентичную копию. */
  async removeIdentical(group, copy) {
    await group.source.remove(copy.path, this.mode);
    this.log(group, copy, 'identical');
  }
}

module.exports = { ConflictActions };
