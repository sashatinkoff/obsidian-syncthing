'use strict';
/*
 * Syncthing Conflict Resolver
 * Файл собран из src/ командой «node tools/build-single.js» — правьте модули в src/, а не этот файл.
 * Все модули внутри, поэтому достаточно скопировать main.js, manifest.json и styles.css.
 */
const obsidian = require('obsidian');

const README = "# Syncthing Conflict Resolver\n\nПлагин Obsidian для разбора конфликтов Syncthing. Конфликты сверяются бок о бок, как в pull request: **текущая версия | результат | конфликтная копия**. Работает на компьютере, Android и iOS.\n\n![Трёхсторонняя сверка заметки](screenshots/02-merge-3way.png)\n\n**Содержание:** [Возможности](#возможности) · [Установка](#установка) · [Быстрый старт](#быстрый-старт) · [Умный разбор](#умный-разбор-тысячи-конфликтов) · [Новое устройство без конфликтов](#как-подключать-новое-устройство-без-лавины-конфликтов) · [Сверка](#сверка) · [Картинки и удалённые файлы](#картинки-и-удалённые-файлы) · [Статистика и журнал](#статистика-и-журнал) · [Папки на устройстве](#папки-на-устройстве) · [На телефоне](#на-телефоне) · [Настройки](#настройки) · [Откуда берётся база](#откуда-берётся-база) · [Вопросы](#частые-вопросы) · [Устройство кода](#устройство-кода)\n\n---\n\n## Возможности\n\n- **Умный разбор тысяч конфликтов.** Каждая копия получает категорию: идентичная, невидимые отличия, только свойства, копия устарела или новее, сливается сама, настоящий конфликт. Всё, что разбирается без потери данных, решается одной кнопкой.\n- **Находит все конфликты.** Ищет файлы `*.sync-conflict-*` в хранилище и, при желании, в папке `.obsidian`. Копии группируются по исходному файлу, у каждой видно, с какого устройства и когда она пришла.\n- **Трёхстороннее слияние.** Если в Syncthing включено версионирование, плагин находит в `.stversions` версию до конфликта и использует её как общего предка. Правки, сделанные только с одной стороны, сливаются сами, вручную остаются только настоящие пересечения.\n- **Свойства по ключам.** Frontmatter сравнивается по каждому свойству отдельно: правка `tags` на телефоне и правка `date` на компьютере не конфликтуют.\n- **Пословная подсветка** отличий, свёртка неизменённых участков, переход между конфликтами.\n- **Решение по каждому блоку:** взять текущую версию, копию, обе в любом порядке, вернуть базу или поправить руками.\n- **Картинки и двоичные файлы** сравниваются целиком: оставить одну версию или сохранить обе.\n- **Исходный файл удалён, а копия осталась** — копию можно восстановить или удалить.\n- **Идентичные копии** (совпадают байт в байт) убираются одной кнопкой.\n- **Массовые действия** над выбранными копиями.\n- **Статистика:** график по дням, устройства, папки, самые конфликтные файлы, время до решения. Отчёт можно сохранить в заметку.\n- **Журнал** всех решений.\n- **Папки на устройстве** помимо хранилища: на компьютере и, в экспериментальном режиме, на Android. У каждой папки есть проверка доступа.\n- **Значок на ленте** со счётчиком конфликтов и быстрым меню.\n- **Светлая и тёмная тема**, раскладка для телефона.\n\n## Установка\n\nДля работы нужны только три файла: `main.js`, `manifest.json` и `styles.css`. Положите их в `<хранилище>/.obsidian/plugins/syncthing-conflict-resolver/`. Можно скопировать и всю папку целиком, тогда README в настройках будет со скриншотами.\n\n```\n.obsidian/plugins/syncthing-conflict-resolver/\n  main.js          ← все модули уже внутри\n  manifest.json\n  styles.css\n  README.md        (необязательно)\n  screenshots/     (необязательно)\n  src/             (необязательно — исходники для правок)\n```\n\nЗатем откройте **Настройки → Сторонние плагины**, нажмите ⟳ («Перезагрузить плагины») и включите **Syncthing Conflict Resolver**.\n\n> Папка `.obsidian` скрытая. На macOS её показывает `Cmd + Shift + .`\n\nВаш установщик, который переносит только эти три файла, подходит: `main.js` самодостаточный.\n\n**На телефон** плагин попадёт сам: `.obsidian/plugins` синхронизируется через Syncthing вместе с хранилищем. Останется включить его в настройках Obsidian на телефоне.\n\n## Быстрый старт\n\nПлагин открывается несколькими способами:\n\n- значок на **левой вертикальной ленте**, на нём виден счётчик открытых конфликтов;\n- **правый клик по значку** открывает быстрое меню;\n- надпись «⇄ N конфликтов» в строке состояния;\n- команда **«Открыть конфликты»** (`Ctrl/Cmd + P`);\n- правый клик по файлу → **«Сверить конфликт Syncthing»**.\n\n![Меню на значке ленты](screenshots/09-ribbon-menu.png)\n\n> Если значка на ленте нет, включите его: **Настройки → Внешний вид → Лента → Управление**. На телефоне значки ленты собраны в меню ☰.\n\nНа вкладке **Конфликты** собрана сводка, полоса проверенных папок, фильтры и карточки файлов с копиями. Нажмите **Сверить** у нужной копии.\n\n![Список конфликтов](screenshots/01-list.png)\n\nКлик по папке в полосе «Проверенные папки» оставляет в списке только её конфликты. Флажки слева включают массовые действия: «Оставить текущие», «Взять копии», «Оставить обе».\n\n## Умный разбор: тысячи конфликтов\n\nПосле первой синхронизации нового устройства конфликтных копий могут оказаться тысячи, причём почти все совпадают с файлами байт в байт. Разбирать их по одной не нужно: плагин сам читает каждую копию и раскладывает их по категориям.\n\n![Умный разбор 15 741 копии](screenshots/15-smart-resolve.png)\n\n| Категория | Что значит | Что делает кнопка |\n|---|---|---|\n| **Идентичные** | Копия совпадает байт в байт | Убрать копии |\n| **Невидимые отличия** | Только переводы строк (CRLF/LF), пробелы в концах строк, BOM, неразрывные пробелы, форма Юникода NFC/NFD (частая история macOS ↔ Android с кириллицей «й», «ё») | Оставить текущие |\n| **Копия устарела** | В текущем файле всё, что в копии, плюс новые строки | Оставить текущие |\n| **Копия новее** | В копии всё, что в текущем файле, плюс новые строки | Взять копии |\n| **Сливаются сами** | Правки в разных местах, база из `.stversions` есть | Слить |\n| **Только свойства** | Текст одинаковый, отличаются свойства | Оставить текущие / взять свойства копий |\n| **Нет исходного файла** | Файл удалён, копия осталась, переименованного файла не нашлось | Восстановить / удалить |\n| **Разные медиа и файлы** | Картинки и прочие файлы отличаются | Оставить текущие / взять копии / оставить обе |\n| **Настоящие конфликты** | Встречные правки в одних и тех же строках | Оставить обе / оставить текущие / сверить по одной |\n\n**Переименованные файлы.** Syncthing видит переименование как «удалить старый файл + создать новый». Если на другом устройстве в это время меняли файл со старым именем, правка сохраняется конфликтной копией со *старым* именем, а исходного файла под ним уже нет. Плагин ищет такой файл под новым именем: сначала по похожему имени (`2026-10-01_09-04-28.md` → `2026-10-01 09-04-28.md` — пробелы, `_`, `-` и регистр не важны), потом по содержимому. Если нашёл, копия сравнивается с новым файлом и попадает в обычную категорию («Идентичные», «Копия устарела» и т. д.), а у файла появляется плашка «было: старое имя». Восстанавливать старое имя и плодить дубли не нужно. Файл с тем же именем в другой папке, но с другим текстом, плагин за переименование не считает.\n\nКнопка **«Разобрать безопасные»** проходит первые пять категорий подряд: в каждом случае остаётся версия, в которой есть всё. Клик по категории показывает её копии в списке, а у каждой категории есть свои кнопки. Ход анализа и разбора виден на полосе прогресса, процесс можно остановить в любой момент.\n\nСписок показывает по 50 файлов, дальше — «Показать ещё», поэтому окно не тормозит даже на десятках тысяч копий. Журнал и статистика при массовом разборе пишут одну сводную запись на пачку, а не тысячи.\n\n> **Совет.** Перед массовым разбором на компьютере выберите в настройках «Куда девать конфликтную копию» → **Системная корзина**. Иначе тысячи копий окажутся в `.trash` внутри хранилища, и Syncthing разнесёт их по всем устройствам.\n\n## Как подключать новое устройство без лавины конфликтов\n\nМассовые конфликты почти всегда появляются при **первой синхронизации** папки с устройством, на котором файлы уже были. Так бывает, если хранилище скопировали заранее, на устройстве осталась старая копия или Obsidian на нём открыли и начали писать в файлы до конца синхронизации. У Syncthing ещё нет общей истории версий с этим устройством, поэтому любой файл, который выглядит изменённым с обеих сторон, становится конфликтом. Иногда изменённым его делает всего лишь время изменения или перевод строки, даже если на вид содержимое не менялось.\n\nПорядок без конфликтов:\n\n1. **На новом устройстве начинайте с пустой папки**, если это возможно, и дождитесь, пока Syncthing скачает всё.\n2. **Если файлы на новом устройстве уже есть**, добавьте папку на нём с типом **«Только приём»** (Receive Only). Локальные отличия тогда не превращаются в конфликтные копии: Syncthing помечает их как «изменено локально» и даёт кнопку **«Отменить локальные изменения»**. После полной синхронизации («Актуально») переключите папку на «Отправка и приём».\n3. **Не открывайте Obsidian на новом устройстве**, пока синхронизация не закончится. Obsidian и плагины пишут в файлы при запуске: `workspace.json`, пересчёт ссылок, обновление свойств.\n4. Добавьте в `.stignore` то, что не нужно синхронизировать: `.obsidian/workspace*.json`, `.trash`.\n\nЕсли конфликты всё же появились, откройте плагин, дождитесь конца анализа и нажмите **«Разобрать безопасные»**. Остаток разберите по категориям.\n\n## Сверка\n\nТри колонки: слева **текущая версия** (синяя), справа **конфликтная копия** (фиолетовая), посередине **результат**. Отличия подсвечены по словам.\n\nБлоки бывают трёх видов:\n\n| Метка | Что значит |\n|---|---|\n| **Авто: текущая / копия** | Изменение есть только с одной стороны, плагин взял его сам |\n| **Одинаково** | Обе стороны изменили блок одинаково |\n| **Конфликт** (оранжевый) | Обе стороны изменили блок по-разному, решаете вы |\n\n![Решения по блокам](screenshots/03-merge-decisions.png)\n\nКак решить блок:\n\n- **›** у левой колонки — взять текущую версию;\n- **‹** у правой колонки — взять копию;\n- **Т+К** / **К+Т** — оставить обе в нужном порядке;\n- **База** — вернуть как было до конфликта;\n- ✎ — поправить результат руками;\n- ↺ — сбросить решение.\n\nВверху показан прогресс «Решено N из M». Стрелки ˄ ˅ переходят между нерешёнными конфликтами, меню ⋯ решает все оставшиеся разом. Когда оранжевых блоков не останется, нажмите **Сохранить результат**: файл перезапишется, копия уйдёт в корзину. Если у файла есть ещё копии, сразу откроется следующая.\n\nКнопки внизу работают с файлом целиком: **Оставить текущую**, **Взять копию**, **Оставить обе** (копия сохранится рядом под именем `заметка (Pixel 8 2026-10-25 19-10).md`).\n\n**Свойства (frontmatter)** сливаются по ключам: каждое свойство — отдельный блок с меткой ключа (`tags`, `date`…).\n\n**Без базы** (версионирование выключено) сверка двусторонняя: каждое отличие решается вручную.\n\n![Двусторонняя сверка без базы](screenshots/04-merge-2way.png)\n\n**Тёмная тема** подхватывается из Obsidian:\n\n![Тёмная тема](screenshots/12-dark.png)\n\n## Картинки и удалённые файлы\n\nКартинки и другие двоичные файлы сравниваются целиком: можно оставить текущую версию, взять копию или сохранить обе.\n\n![Конфликт картинки](screenshots/05-image.png)\n\nЕсли исходный файл удалили или переименовали на одном устройстве, а на другом изменили, остаётся только копия. Её можно **восстановить** под исходным именем или **удалить**.\n\n![Исходный файл удалён](screenshots/06-deleted-original.png)\n\n## Статистика и журнал\n\nВкладка **Статистика** копит данные с момента установки: каждую найденную конфликтную копию и каждое решение. Период можно выбрать: 7, 30, 90 дней или всё время.\n\n![Статистика](screenshots/07-stats.png)\n\n- **Появилось / Решено / Открыто сейчас** — общий счёт.\n- **До решения** — медиана и среднее время от появления копии до её решения.\n- **Автослияние** — доля блоков, которые слились без вашего участия.\n- **По дням** — сколько конфликтов появилось и сколько решено.\n- Разбивки **по устройствам, папкам, файлам, способам решения, типам файлов и дням недели**. Клик по файлу открывает его.\n\nКнопка **«Отчёт в заметку»** (или команда «Сохранить отчёт статистики в заметку») записывает сводку таблицами в `Syncthing/Статистика конфликтов.md`. Путь меняется в настройках.\n\nВо вкладке **Журнал** лежит хронология решений: что сделано, с какого устройства пришла копия и через сколько её разобрали.\n\n![Журнал](screenshots/08-journal.png)\n\n## Папки на устройстве\n\nКроме хранилища плагин может проверять любые другие папки Syncthing. Их список задаётся в **Настройки → Syncthing Conflict Resolver → Папки на этом устройстве**.\n\n![Папки на компьютере](screenshots/10-settings-folders.png)\n\n- **Проверить и добавить** — плагин сначала проверит доступ и посчитает файлы и конфликты, и только потом добавит папку.\n- **Проверить** — повторная проверка: «Доступ есть · 3 файла · конфликтов: 1» или текст ошибки («Папка не найдена», «Нет доступа…»).\n- Флажок включает и выключает проверку папки, не удаляя её из списка.\n- Второе поле — папка версий (`.stversions`) для автослияния.\n- Команда **«Проверить папки на устройстве»** перепроверяет всё сразу.\n\n**У каждого устройства свой список.** Настройки плагина синхронизируются, но папка, добавленная на Mac, на телефоне не проверяется (и наоборот). Внизу раздела написано, сколько папок настроено на других устройствах.\n\n| Платформа | Что можно |\n|---|---|\n| **Компьютер** | Любые папки, есть кнопка «Выбрать…» |\n| **Android** (экспериментально) | Путь вида `/storage/emulated/0/Syncthing/Документы`. Нужен доступ Obsidian ко всем файлам: Настройки Android → Приложения → Obsidian → Разрешения. Корзины на телефоне нет, поэтому убранные копии кладутся в `.sync-conflict-trash` внутри папки |\n| **iPhone / iPad** | iOS не пускает приложения за пределы хранилища. Откройте нужную папку как отдельное хранилище и включите в нём плагин, а `.obsidian` добавьте в `.stignore` этой папки |\n\n## На телефоне\n\nНа узком экране колонки сверки складываются в стопку: **текущая → копия → результат**. У каждого блока есть кнопки «Взять». Неактивные вкладки сворачиваются до иконок.\n\n![Плагин на телефоне](screenshots/13-mobile.png)\n\n![Папки на Android и тёмная тема](screenshots/14-mobile-folders-dark.png)\n\n## Настройки\n\n![Настройки](screenshots/11-settings.png)\n\n| Раздел | Что настраивается |\n|---|---|\n| **Поиск конфликтов** | Проверять ли `.obsidian`; следить ли за новыми конфликтами; уведомления; исключённые папки (с автодополнением) |\n| **База для автослияния** | Папка версий (`.stversions` или абсолютный путь на компьютере); путь хранилища внутри папки Syncthing; автовыбор базы |\n| **Сверка** | Сколько строк контекста показывать; слияние свойств по ключам; игнорировать пробелы в конце строк; куда девать копию: корзина Obsidian, системная корзина или удалять насовсем |\n| **Устройства** | Адрес и API-ключ Syncthing, кнопка «Загрузить имена»; ручные имена для ID устройств |\n| **Статистика** | Путь заметки с отчётом |\n| **Папки на этом устройстве** | Имя устройства, список папок, проверка доступа |\n\nЭтот README открывается и прямо в настройках плагина: блок «Как пользоваться (README)» вверху.\n\n## Откуда берётся база\n\nУ Syncthing нет общего предка, как в git. Он оставляет только две версии: исходный файл и `.sync-conflict-…`. Чтобы появилась третья, включите для папки хранилища **версионирование** (Syncthing → папка → Изменить → Версионирование → «Простое» или «Поэтапное»). Тогда старые версии будут складываться в `.stversions`.\n\nПлагин сам выбирает самую свежую версию, сохранённую до момента конфликта. Это эвристика. Если база совпала с одной из сторон, появится предупреждение. Тогда базу можно выбрать вручную в шапке сверки или отключить («Без базы — двустороннее»).\n\nЕсли в Syncthing синхронизируется папка выше хранилища, укажите в настройках путь хранилища внутри неё (например, `Notes/Vault`), иначе версии не найдутся.\n\n## Частые вопросы\n\n**Плагин не видит конфликты.** Нажмите ⟳ в шапке окна. Проверьте, что папка с конфликтом не попала в «Исключённые папки».\n\n**Почему всё «Конфликт», а не «Авто»?** Базы нет: версионирование в Syncthing выключено, или в `.stversions` нет подходящей версии. См. [Откуда берётся база](#откуда-берётся-база).\n\n**Копии есть, а исходного файла нет.** Чаще всего его переименовали или удалили на другом устройстве (см. «Переименованные файлы» выше). Плагин сам найдёт переименованный файл. Если не нашёл, копия будет в категории «Нет исходного файла»: восстановите её, если файл удалили по ошибке, или удалите копию.\n\n**Куда делась конфликтная копия?** В корзину Obsidian (`.trash`), в системную корзину или удалена — смотря что выбрано в настройках. Для папок на Android — в `.sync-conflict-trash` внутри папки.\n\n**Вместо ID устройства хочу видеть имя.** Настройки → Устройства: впишите имя вручную или вставьте API-ключ Syncthing и нажмите «Загрузить имена».\n\n**Что-то сломалось.** Откройте консоль (`Cmd/Ctrl + Option/Shift + I` → Console) и найдите строки с `[Syncthing Conflict Resolver]`.\n\n## Устройство кода\n\n```\nmain.js                  собранный плагин: все модули src/ внутри (генерируется, не править руками)\nsrc/plugin.js            ядро: настройки, сканирование, лента, команды, события\nsrc/constants.js         регулярки имён, настройки по умолчанию\nsrc/util.js              даты, пути, размеры\nsrc/journal.js           журнал действий\nsrc/stats.js             статистика: обнаружение, время до решения, ряды по дням\nsrc/settings.js          вкладка настроек (с этим README)\nsrc/core/diff.js         diff Майерса построчно и пословно\nsrc/core/merge.js        двух- и трёхстороннее слияние, свойства по ключам\nsrc/core/classify.js     категории конфликтов: идентичные, невидимые отличия, свойства, расширения, автослияние\nsrc/io/sources.js        хранилище, папки на компьютере (Node fs) и на Android\nsrc/io/scanner.js        поиск конфликтов и версий .stversions\nsrc/io/actions.js        сохранить / оставить / взять / обе\nsrc/io/bulk.js           массовый анализ и пакетные действия по категориям\nsrc/io/syncthing-api.js  имена устройств через REST API Syncthing\nsrc/ui/view.js           окно-вкладка\nsrc/ui/list-tab.js       вкладка «Конфликты»\nsrc/ui/bulk-panel.js     панель «Умный разбор»\nsrc/ui/merge-tab.js      вкладка «Сверка»\nsrc/ui/merge-session.js  состояние одной сверки\nsrc/ui/stats-tab.js      вкладка «Статистика»\nsrc/ui/journal-tab.js    вкладка «Журнал»\nsrc/ui/dom.js            кнопки, карточки, подтверждения\ntools/build-single.js    сборка main.js из src/: node tools/build-single.js\nscreenshots/             картинки для этого README\n```\n\nПравки делаются в `src/`, после них нужно пересобрать `main.js` командой `node tools/build-single.js`. Нужен только Node.js, зависимостей нет.\n\nСкриншоты сняты на демонстрационных данных.\n";

const MODULES = {
  "src/constants.js": function (module, exports, require) {
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

  },
  "src/core/classify.js": function (module, exports, require) {
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

  },
  "src/core/diff.js": function (module, exports, require) {
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

  },
  "src/core/merge.js": function (module, exports, require) {
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

  },
  "src/io/actions.js": function (module, exports, require) {
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
  async takeCopy(group, copy, opts = {}) {
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
    if (opts.log !== false) this.log(group, copy, 'take');
  }

  /** Оставить обе: копия переименовывается в «имя (устройство дата).ext». */
  async keepBoth(group, copy, opts = {}) {
    const { dir, stem, ext } = splitExt(group.path);
    const name = `${stem} (${this.plugin.deviceName(copy.device)} ${fileStamp(copy.time)})${ext}`;
    const target = await uniquePath(group.source, joinPath(dir, name));
    await group.source.rename(copy.path, target);
    if (opts.log !== false) this.log(group, copy, 'both', { target });
    return target;
  }

  /** Убрать идентичную копию. */
  async removeIdentical(group, copy) {
    await group.source.remove(copy.path, this.mode);
    this.log(group, copy, 'identical');
  }
}

module.exports = { ConflictActions };

  },
  "src/io/bulk.js": function (module, exports, require) {
'use strict';
/**
 * Массовый разбор: анализ всех конфликтных копий и пакетные действия по категориям.
 * Рассчитан на десятки тысяч копий: чтение пачками, уступки интерфейсу, отмена, один журнал на всю пачку.
 */

const { TFile } = require('obsidian');
const { classifyText, normalize, CATEGORY_ORDER } = require('../core/classify');
const { pickBase, attachRenamed, isConflictPath } = require('./scanner');
const { sameBuffers, dirname, extOf } = require('../util');

const CATEGORIES = {
  identical: {
    label: 'Идентичные', ico: 'copy-check', tone: 'ok',
    hint: 'Копия совпадает с файлом байт в байт',
    actions: [{ id: 'remove', text: 'Убрать копии', primary: true }],
  },
  whitespace: {
    label: 'Невидимые отличия', ico: 'pilcrow', tone: 'ok',
    hint: 'Только переводы строк, пробелы в концах строк, BOM или форма Юникода (NFC/NFD)',
    actions: [{ id: 'remove', text: 'Оставить текущие', primary: true }],
  },
  'current-newer': {
    label: 'Копия устарела', ico: 'file-check', tone: 'ok',
    hint: 'В текущем файле всё, что есть в копии, плюс новые строки',
    actions: [{ id: 'remove', text: 'Оставить текущие', primary: true }],
  },
  'copy-newer': {
    label: 'Копия новее', ico: 'file-input', tone: 'info',
    hint: 'В копии всё, что есть в текущем файле, плюс новые строки',
    actions: [{ id: 'take', text: 'Взять копии', primary: true }, { id: 'remove', text: 'Оставить текущие' }],
  },
  props: {
    label: 'Только свойства', ico: 'list', tone: 'info',
    hint: 'Текст одинаковый, отличаются свойства (frontmatter)',
    actions: [{ id: 'remove', text: 'Оставить текущие свойства', primary: true }, { id: 'take', text: 'Взять свойства копий' }],
  },
  auto: {
    label: 'Сливаются сами', ico: 'sparkles', tone: 'info',
    hint: 'Правки в разных местах — трёхстороннее слияние с базой из .stversions без конфликтов',
    actions: [{ id: 'merge', text: 'Слить', primary: true }],
  },
  missing: {
    label: 'Нет исходного файла', ico: 'file-x', tone: 'warn',
    hint: 'Файл удалили, а копия осталась; переименованного файла с таким же содержимым не нашлось',
    actions: [{ id: 'restore', text: 'Восстановить из копий' }, { id: 'remove', text: 'Удалить копии' }],
  },
  binary: {
    label: 'Разные медиа и файлы', ico: 'image', tone: 'warn',
    hint: 'Картинки и другие двоичные файлы отличаются',
    actions: [{ id: 'remove', text: 'Оставить текущие' }, { id: 'take', text: 'Взять копии' }, { id: 'both', text: 'Оставить обе' }],
  },
  conflict: {
    label: 'Настоящие конфликты', ico: 'git-merge', tone: 'conflict',
    hint: 'Встречные правки в одних и тех же местах — нужна сверка',
    actions: [{ id: 'both', text: 'Оставить обе версии' }, { id: 'remove', text: 'Оставить текущие' }],
  },
};

const ACTION_VERB = {
  remove: 'Убрано копий',
  take: 'Взято копий',
  merge: 'Слито',
  restore: 'Восстановлено',
  both: 'Сохранено рядом',
};

const tick = () => new Promise((r) => setTimeout(r, 0));

class Bulk {
  constructor(core) {
    this.core = core;
    this.state = null; // { kind: 'analyze'|'run', done, total, started, label, cancel }
  }

  get running() { return !!this.state; }

  cancel() { if (this.state) this.state.cancelled = true; }

  progress(done, st) {
    const s = st || this.state;
    if (!s || s !== this.state) return;
    s.done = done;
    const now = Date.now();
    if (now - (s.lastEmit || 0) > 200 || done === s.total) {
      s.lastEmit = now;
      this.core.emitProgress();
    }
  }

  /* ---------- анализ ---------- */

  /** Классифицирует все копии текущего скана. Результат — в copy.category / copy.detail. */
  async analyze(scan) {
    const items = [];
    for (const g of scan.groups) for (const c of g.copies) items.push([g, c]);
    scan.analysis = { done: false, total: items.length, counts: {} };
    if (!items.length) { scan.analysis.done = true; return scan.analysis; }
    if (this.state && this.state.kind === 'run') return scan.analysis; // идёт массовое действие — пересчитаем после него

    // Предыдущий анализ (старого скана) останавливаем — у каждого своё состояние
    if (this.state) this.state.cancelled = true;
    const st = { kind: 'analyze', label: 'Анализ копий', done: 0, total: items.length, started: Date.now() };
    this.state = st;
    this.core.emitProgress();

    this.sizeIndex = null; // для поиска переименованных файлов по содержимому — строится по требованию
    const cache = new Map(); // текущий файл группы — читаем один раз
    const readCurrent = async (g) => {
      if (!g.exists) return null;
      if (cache.has(g.id)) return cache.get(g.id);
      const p = g.kind === 'text' ? g.source.read(g.path) : g.source.readBinary(g.path);
      cache.set(g.id, p);
      return p;
    };

    let done = 0;
    const BATCH = 16;
    try {
      for (let i = 0; i < items.length; i += BATCH) {
        if (st.cancelled || this.core.scan !== scan) break;
        const batch = items.slice(i, i + BATCH);
        await Promise.all(batch.map(async ([g, c]) => {
          try {
            await this.classify(g, c, readCurrent);
          } catch (e) {
            c.category = 'conflict';
            c.detail = `не удалось прочитать: ${e.message}`;
          }
          c.identical = c.category === 'identical';
        }));
        // Группа разобрана целиком — освобождаем память
        for (const [g] of batch) if (g.copies.every((c) => c.category)) cache.delete(g.id);
        done += batch.length;
        this.progress(done, st);
        await tick();
      }
    } finally {
      const counts = {};
      for (const [, c] of items) if (c.category) counts[c.category] = (counts[c.category] || 0) + 1;
      scan.analysis = { done: done === items.length, total: items.length, analyzed: done, counts, ms: Date.now() - st.started };
      if (this.state === st) {
        this.state = null;
        this.core.emit();
      }
    }
    return scan.analysis;
  }

  async classify(g, c, readCurrent) {
    const src = g.source;
    if (!g.exists && g.kind === 'text') {
      // Один поиск на файл: остальные копии этого файла ждут его результат
      if (!g.renameSearch) {
        g.renameSearch = (async () => {
          const target = await this.findByContent(g, c);
          if (target && !g.exists) await attachRenamed(g, target, 'content');
        })();
      }
      await g.renameSearch;
    }
    if (!g.exists) { c.category = 'missing'; c.detail = null; return; }

    if (g.kind !== 'text') {
      const [a, b] = await Promise.all([readCurrent(g), src.readBinary(c.path)]);
      c.category = sameBuffers(a, b) ? 'identical' : 'binary';
      c.detail = null;
      return;
    }

    const [cur, copy] = await Promise.all([readCurrent(g), src.read(c.path)]);
    let base = null;
    if (cur !== copy && this.core.settings.autoBase !== false) {
      const ver = pickBase(g, c);
      if (ver) { try { base = await ver.source.read(ver.path); } catch (e) { base = null; } }
    }
    const r = classifyText({ current: cur, copy, base, mergeProperties: this.core.settings.mergeProperties });
    // Файл с похожим именем в другой папке, но с совсем другим текстом — это не наш файл
    if (g.renamedFrom && g.renamedHow === 'name' && r.category === 'conflict' && dirname(g.renamedFrom) !== dirname(g.path)) {
      this.detachRenamed(g);
      c.category = 'missing';
      c.detail = null;
      return;
    }
    c.category = r.category;
    c.detail = r.detail || null;
    c.hasBase = base !== null;
    if (g.renamedFrom) c.detail = `переименован → ${g.name}${c.detail ? ` · ${c.detail}` : ''}`;
  }

  detachRenamed(g) {
    g.path = g.renamedFrom;
    g.name = g.renamedFrom.split('/').pop();
    g.renamedFrom = null;
    g.renamedHow = null;
    g.exists = false;
    g.size = null;
    g.mtime = null;
  }

  /** Переименованный файл с тем же содержимым: ищем среди файлов того же типа и почти того же размера. */
  async findByContent(g, c) {
    if (g.source.kind !== 'vault' || c.size === null || c.size === undefined) return null;
    if (!this.sizeIndex) {
      this.sizeIndex = new Map();
      for (const f of this.core.app.vault.getFiles()) {
        if (!(f instanceof TFile) || isConflictPath(f.path) || !f.stat) continue;
        const k = `${f.extension.toLowerCase()}:${f.stat.size}`;
        if (!this.sizeIndex.has(k)) this.sizeIndex.set(k, []);
        this.sizeIndex.get(k).push(f.path);
      }
    }
    const ext = extOf(g.path);
    const cand = [];
    for (let d = -16; d <= 16 && cand.length < 12; d++) {
      const list = this.sizeIndex.get(`${ext}:${c.size + d}`);
      if (list) for (const p of list) if (cand.length < 12) cand.push(p);
    }
    if (!cand.length) return null;
    const copy = normalize(await g.source.read(c.path));
    const dir = dirname(g.path);
    cand.sort((a, b) => (dirname(b) === dir) - (dirname(a) === dir));
    for (const p of cand) {
      try { if (normalize(await g.source.read(p)) === copy) return p; } catch (e) { /* пропускаем */ }
    }
    return null;
  }

  /* ---------- пакетные действия ---------- */

  /** Пары [группа, копия] категории. */
  items(category) {
    const scan = this.core.scan;
    if (!scan) return [];
    const out = [];
    for (const g of scan.groups) for (const c of g.copies) if (c.category === category) out.push([g, c]);
    return out;
  }

  /**
   * Выполнить действие над всеми копиями категории.
   * @returns {Promise<{ok:number, failed:number, skipped:number, errors:string[], cancelled:boolean}>}
   */
  async run(category, action) {
    const items = this.items(category);
    const res = { ok: 0, failed: 0, skipped: 0, errors: [], cancelled: false };
    if (!items.length) return res;
    const meta = CATEGORIES[category];
    const mode = this.core.settings.removeMode;

    if (this.state) this.state.cancelled = true; // останавливаем идущий анализ
    const st = { kind: 'run', label: `${meta.label}: ${ACTION_VERB[action].toLowerCase()}`, done: 0, total: items.length, started: Date.now() };
    this.state = st;
    this.core.emitProgress();

    // Для действий, меняющих сам файл, у группы берём одну (самую свежую) копию — остальные пересчитаются
    const changesFile = action === 'take' || action === 'merge' || action === 'restore';
    const touched = new Set();

    try {
      for (let i = 0; i < items.length; i++) {
        if (st.cancelled) { res.cancelled = true; break; }
        const [g, c] = items[i];
        try {
          if (changesFile && touched.has(g.id)) { res.skipped++; continue; }
          await this.apply(g, c, action, mode);
          if (changesFile) touched.add(g.id);
          res.ok++;
        } catch (e) {
          res.failed++;
          if (res.errors.length < 20) res.errors.push(`${g.path}: ${e.message}`);
        }
        this.progress(i + 1, st);
        if (i % 20 === 19) await tick();
      }
    } finally {
      if (this.state === st) this.state = null;
      if (res.ok) {
        this.core.journal.add({
          t: Date.now(),
          bulk: true,
          n: res.ok,
          category,
          action: action === 'remove' ? 'keep' : action === 'restore' ? 'take' : action,
          path: `Массовый разбор · ${meta.label} · ${res.ok}`,
          source: 'Хранилище',
          device: null,
        });
      }
      this.core.emit();
    }
    return res;
  }

  async apply(g, c, action, mode) {
    const src = g.source;
    const a = this.core.actions;
    switch (action) {
      case 'remove':
        await src.remove(c.path, mode);
        return;
      case 'take':
        await a.takeCopy(g, c, { log: false });
        return;
      case 'restore':
        if (await src.exists(g.path)) throw new Error('файл уже существует');
        await src.rename(c.path, g.path);
        return;
      case 'both':
        await a.keepBoth(g, c, { log: false });
        return;
      case 'merge': {
        const [cur, copy] = await Promise.all([src.read(g.path), src.read(c.path)]);
        const ver = pickBase(g, c);
        const base = ver ? await ver.source.read(ver.path) : null;
        const r = classifyText({ current: cur, copy, base, mergeProperties: this.core.settings.mergeProperties });
        if (r.category !== 'auto' || r.merged === null || r.merged === undefined) throw new Error('файл изменился, слить автоматически нельзя');
        await src.write(g.path, r.merged);
        await src.remove(c.path, mode);
        return;
      }
      default:
        throw new Error(`неизвестное действие ${action}`);
    }
  }
}

module.exports = { Bulk, CATEGORIES, CATEGORY_ORDER, ACTION_VERB };

  },
  "src/io/scanner.js": function (module, exports, require) {
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

  },
  "src/io/sources.js": function (module, exports, require) {
'use strict';
/**
 * Источники файлов. Все пути внутри источника — относительные, через «/».
 *   VaultSource — хранилище Obsidian (работает везде, включая Android/iOS)
 *   FsSource    — произвольная папка на диске через Node fs (только десктоп)
 */

const { TFile, Platform } = require('obsidian');
const { joinPath } = require('../util');

const SKIP_DIRS = new Set(['.stversions', '.stfolder', '.stignore', '.git', 'node_modules', '.sync-conflict-trash']);

class VaultSource {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.adapter = plugin.app.vault.adapter;
    this.kind = 'vault';
    this.id = 'vault';
    this.label = 'Хранилище';
    this.root = '';
  }

  /** Ключ для сопоставления с .stversions (путь относительно папки Syncthing). */
  syncKey(path) {
    return joinPath(this.plugin.settings.vaultSubpath, path);
  }

  async listAll() {
    const s = this.plugin.settings;
    const files = this.app.vault.getFiles().map((f) => f.path);
    if (s.scanConfigDir) {
      const cfg = this.app.vault.configDir;
      files.push(...(await this.listRecursive(cfg)));
    }
    return files;
  }

  async listRecursive(dir) {
    const out = [];
    const walk = async (d) => {
      let r;
      try { r = await this.adapter.list(d); } catch (e) { return; }
      out.push(...r.files);
      for (const f of r.folders) {
        const name = f.slice(f.lastIndexOf('/') + 1);
        if (name === 'node_modules' || name === '.git') continue;
        await walk(f);
      }
    };
    await walk(dir);
    return out;
  }

  file(path) {
    const f = this.app.vault.getAbstractFileByPath(path);
    return f instanceof TFile ? f : null;
  }

  async exists(path) {
    if (this.app.vault.getAbstractFileByPath(path)) return true;
    return this.adapter.exists(path);
  }

  async stat(path) {
    const f = this.file(path);
    if (f && f.stat) return { mtime: f.stat.mtime, size: f.stat.size };
    try {
      const s = await this.adapter.stat(path);
      return s ? { mtime: s.mtime, size: s.size } : null;
    } catch (e) { return null; }
  }

  async read(path) {
    const f = this.file(path);
    return f ? this.app.vault.read(f) : this.adapter.read(path);
  }

  async readBinary(path) {
    const f = this.file(path);
    return f ? this.app.vault.readBinary(f) : this.adapter.readBinary(path);
  }

  async write(path, text) {
    const f = this.file(path);
    if (f) await this.app.vault.modify(f, text);
    else await this.adapter.write(path, text);
  }

  async writeBinary(path, data) {
    const f = this.file(path);
    if (f && this.app.vault.modifyBinary) await this.app.vault.modifyBinary(f, data);
    else await this.adapter.writeBinary(path, data);
  }

  async rename(from, to) {
    const f = this.file(from);
    if (f) await this.app.vault.rename(f, to);
    else await this.adapter.rename(from, to);
  }

  async remove(path, mode) {
    const f = this.file(path);
    if (mode === 'delete') {
      if (f) await this.app.vault.delete(f);
      else await this.adapter.remove(path);
      return;
    }
    if (mode === 'system') {
      if (f) { await this.app.vault.trash(f, true); return; }
      const ok = await this.adapter.trashSystem(path);
      if (ok) return;
    }
    if (f) await this.app.vault.trash(f, false);
    else await this.adapter.trashLocal(path);
  }

  resourceUrl(path) {
    return this.adapter.getResourcePath(path);
  }

  /** Источник для папки версий: внутри хранилища — этот же, абсолютный путь — Fs (только десктоп). */
  versionsLocation() {
    const vp = (this.plugin.settings.versionsPath || '').trim();
    if (!vp) return null;
    if (/^([a-zA-Z]:[\\/]|\/)/.test(vp)) {
      if (!Platform.isDesktopApp) return null;
      return { source: new FsSource(vp, 'Версии'), dir: '' };
    }
    return { source: this, dir: vp.replace(/^\/+|\/+$/g, '') };
  }

  openable(path) { return !!this.file(path); }
}

class FsSource {
  constructor(root, label) {
    this.fs = require('fs').promises;
    this.nodePath = require('path');
    this.root = root;
    this.kind = 'fs';
    this.id = `fs:${root}`;
    this.label = label || root;
    this.blobUrls = [];
  }

  abs(rel) { return rel ? this.nodePath.join(this.root, ...rel.split('/')) : this.root; }
  syncKey(path) { return path; }

  /** Проверка доступа к папке: { ok, error }. */
  async check() {
    try {
      const s = await this.fs.stat(this.root);
      if (!s.isDirectory()) return { ok: false, error: 'Это не папка' };
      await this.fs.readdir(this.root);
      return { ok: true };
    } catch (e) {
      if (e.code === 'ENOENT') return { ok: false, error: 'Папка не найдена' };
      if (e.code === 'EACCES' || e.code === 'EPERM') return { ok: false, error: 'Нет доступа к папке' };
      return { ok: false, error: e.message };
    }
  }

  async listAll(excluded = []) {
    return this.listRecursive('', excluded);
  }

  async listRecursive(relDir, excluded = []) {
    const out = [];
    const walk = async (rel) => {
      let entries;
      try { entries = await this.fs.readdir(this.abs(rel), { withFileTypes: true }); } catch (e) { return; }
      for (const e of entries) {
        const child = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) {
          if (SKIP_DIRS.has(e.name)) continue;
          if (excluded.some((x) => child === x || child.startsWith(`${x}/`))) continue;
          await walk(child);
        } else if (e.isFile()) {
          out.push(child);
        }
      }
    };
    await walk(relDir);
    return out;
  }

  async exists(rel) {
    try { await this.fs.access(this.abs(rel)); return true; } catch (e) { return false; }
  }

  async stat(rel) {
    try {
      const s = await this.fs.stat(this.abs(rel));
      return { mtime: s.mtimeMs, size: s.size };
    } catch (e) { return null; }
  }

  async read(rel) { return this.fs.readFile(this.abs(rel), 'utf8'); }

  async readBinary(rel) {
    const b = await this.fs.readFile(this.abs(rel));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  }

  async write(rel, text) { await this.fs.writeFile(this.abs(rel), text, 'utf8'); }
  async writeBinary(rel, data) { await this.fs.writeFile(this.abs(rel), Buffer.from(data)); }
  async rename(from, to) { await this.fs.rename(this.abs(from), this.abs(to)); }

  async remove(rel, mode) {
    const full = this.abs(rel);
    if (mode === 'delete') { await this.fs.unlink(full); return; }
    try {
      const { shell } = require('electron');
      if (shell && shell.trashItem) { await shell.trashItem(full); return; }
    } catch (e) { /* нет доступа к корзине — уберём в локальную папку */ }
    const trashDir = this.nodePath.join(this.root, '.sync-conflict-trash');
    await this.fs.mkdir(trashDir, { recursive: true });
    const target = this.nodePath.join(trashDir, `${Date.now()}-${this.nodePath.basename(full)}`);
    await this.fs.rename(full, target);
  }

  resourceUrl(rel) {
    // Картинки вне хранилища показываем через blob: читаем файл целиком
    return null;
  }

  versionsLocation(versionsPath) {
    const vp = (versionsPath || '.stversions').trim();
    if (/^([a-zA-Z]:[\\/]|\/)/.test(vp)) return { source: new FsSource(vp, 'Версии'), dir: '' };
    return { source: this, dir: vp };
  }

  openable() { return false; }
}

/* ---------- Android: папки вне хранилища через файловый API приложения ---------- */

function capacitorFs(app) {
  const cap = window.Capacitor;
  const fs = (cap && cap.Plugins && cap.Plugins.Filesystem) || (app && app.vault.adapter && app.vault.adapter.fs);
  return fs && typeof fs.readdir === 'function' && typeof fs.readFile === 'function' ? fs : null;
}

function base64ToBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Папка на телефоне (Android) вне хранилища, например /storage/emulated/0/Syncthing/Docs.
 * Экспериментально: работает, если у Obsidian есть доступ ко всем файлам
 * (так обычно и есть, когда хранилище лежит в общей памяти телефона).
 */
class MobileFsSource {
  constructor(app, root, label) {
    this.app = app;
    this.fsApi = capacitorFs(app);
    this.root = root.replace(/\/+$/, '');
    this.kind = 'mobile';
    this.id = `mobile:${this.root}`;
    this.label = label || this.root.split('/').pop();
  }

  static available(app) { return !!capacitorFs(app); }

  uri(rel) {
    const base = this.root.startsWith('file://') ? this.root : `file://${this.root.startsWith('/') ? '' : '/'}${this.root}`;
    return rel ? `${base}/${rel.split('/').map(encodeURIComponent).join('/')}` : base;
  }

  syncKey(path) { return path; }

  async check() {
    if (!this.fsApi) return { ok: false, error: 'Файловый API недоступен на этом устройстве' };
    try {
      await this.fsApi.readdir({ path: this.uri('') });
      return { ok: true };
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/not exist|no such|ENOENT/i.test(msg)) return { ok: false, error: 'Папка не найдена' };
      if (/permission|denied|EACCES/i.test(msg)) return { ok: false, error: 'Нет доступа: разрешите Obsidian доступ ко всем файлам' };
      return { ok: false, error: msg };
    }
  }

  async entries(rel) {
    const r = await this.fsApi.readdir({ path: this.uri(rel) });
    const out = [];
    for (const f of r.files || []) {
      if (typeof f === 'string') {
        const child = rel ? `${rel}/${f}` : f;
        let type = 'file';
        try { type = (await this.fsApi.stat({ path: this.uri(child) })).type; } catch (e) { /* считаем файлом */ }
        out.push({ name: f, dir: type === 'directory' });
      } else {
        out.push({ name: f.name, dir: f.type === 'directory' });
      }
    }
    return out;
  }

  async listAll(excluded = []) { return this.listRecursive('', excluded); }

  async listRecursive(relDir, excluded = []) {
    const out = [];
    const walk = async (rel) => {
      let list;
      try { list = await this.entries(rel); } catch (e) { return; }
      for (const e of list) {
        const child = rel ? `${rel}/${e.name}` : e.name;
        if (e.dir) {
          if (SKIP_DIRS.has(e.name)) continue;
          if (excluded.some((x) => child === x || child.startsWith(`${x}/`))) continue;
          await walk(child);
        } else {
          out.push(child);
        }
      }
    };
    await walk(relDir);
    return out;
  }

  async exists(rel) {
    try { await this.fsApi.stat({ path: this.uri(rel) }); return true; } catch (e) { return false; }
  }

  async stat(rel) {
    try {
      const s = await this.fsApi.stat({ path: this.uri(rel) });
      return { mtime: Number(s.mtime || s.ctime || 0), size: Number(s.size || 0) };
    } catch (e) { return null; }
  }

  async read(rel) {
    const r = await this.fsApi.readFile({ path: this.uri(rel), encoding: 'utf8' });
    return typeof r.data === 'string' ? r.data : await r.data.text();
  }

  async readBinary(rel) {
    const r = await this.fsApi.readFile({ path: this.uri(rel) });
    return typeof r.data === 'string' ? base64ToBuffer(r.data) : await r.data.arrayBuffer();
  }

  async write(rel, text) { await this.fsApi.writeFile({ path: this.uri(rel), data: text, encoding: 'utf8' }); }
  async writeBinary(rel, data) { await this.fsApi.writeFile({ path: this.uri(rel), data: bufferToBase64(data) }); }
  async rename(from, to) { await this.fsApi.rename({ from: this.uri(from), to: this.uri(to) }); }

  async remove(rel, mode) {
    if (mode === 'delete') { await this.fsApi.deleteFile({ path: this.uri(rel) }); return; }
    // Корзины на телефоне нет — переносим в служебную папку внутри синхронизируемой
    try { await this.fsApi.mkdir({ path: this.uri('.sync-conflict-trash'), recursive: true }); } catch (e) { /* уже есть */ }
    const name = rel.split('/').pop();
    await this.fsApi.rename({ from: this.uri(rel), to: this.uri(`.sync-conflict-trash/${Date.now()}-${name}`) });
  }

  resourceUrl() { return null; }

  versionsLocation(versionsPath) {
    const vp = (versionsPath || '.stversions').trim().replace(/^\/+|\/+$/g, '');
    return { source: this, dir: vp };
  }

  openable() { return false; }
}

/** Источник для папки из настроек под текущую платформу (или null, если здесь недоступно). */
function createFolderSource(app, folder) {
  if (!folder || !folder.path) return null;
  const label = folder.label || folder.path.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
  let src = null;
  if (Platform.isDesktopApp) src = new FsSource(folder.path, label);
  else if (Platform.isAndroidApp && MobileFsSource.available(app)) src = new MobileFsSource(app, folder.path, label);
  if (src) src.versionsPath = folder.versionsPath || '.stversions';
  return src;
}

/** Можно ли на этом устройстве работать с папками вне хранилища. */
function deviceFoldersSupport(app) {
  if (Platform.isDesktopApp) return 'desktop';
  if (Platform.isAndroidApp && MobileFsSource.available(app)) return 'android';
  return null;
}

/** Выбор папки на десктопе: диалог Electron, иначе скрытый input. */
async function pickFolder() {
  try {
    const electron = require('electron');
    let remote = electron.remote;
    if (!remote) { try { remote = require('@electron/remote'); } catch (e) { remote = null; } }
    if (remote && remote.dialog) {
      const r = await remote.dialog.showOpenDialog({ properties: ['openDirectory'] });
      if (r.canceled || !r.filePaths || !r.filePaths[0]) return null;
      return r.filePaths[0];
    }
  } catch (e) { /* переходим к запасному варианту */ }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) { resolve(null); return; }
      let p = f.path;
      try {
        const { webUtils } = require('electron');
        if (!p && webUtils) p = webUtils.getPathForFile(f);
      } catch (e) { /* ignore */ }
      if (!p) { resolve(null); return; }
      const nodePath = require('path');
      const depth = (f.webkitRelativePath || '').split('/').length - 1;
      let dir = p;
      for (let i = 0; i < depth; i++) dir = nodePath.dirname(dir);
      resolve(dir);
    });
    input.click();
  });
}

module.exports = { VaultSource, FsSource, MobileFsSource, createFolderSource, deviceFoldersSupport, pickFolder };

  },
  "src/io/syncthing-api.js": function (module, exports, require) {
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

module.exports = { fetchDeviceNames };

  },
  "src/journal.js": function (module, exports, require) {
'use strict';

const ACTION_LABELS = {
  merge: 'Слияние',
  keep: 'Оставлена текущая',
  take: 'Взята копия',
  both: 'Оставлены обе',
  identical: 'Идентичная копия',
};

class Journal {
  constructor(plugin, entries) {
    this.plugin = plugin;
    this.entries = Array.isArray(entries) ? entries : [];
  }

  add(entry) {
    this.entries.unshift(entry);
    const limit = this.plugin.settings.journalLimit || 500;
    if (this.entries.length > limit) this.entries.length = limit;
    // Сохраняем не чаще раза в секунду: при массовых действиях data.json не перезаписывается тысячи раз
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.plugin.saveData_();
    }, 1000);
  }

  clear() {
    this.entries = [];
    this.plugin.saveData_();
  }

  summary() {
    const weekAgo = Date.now() - 7 * 864e5;
    const byDevice = new Map();
    const byAction = new Map();
    let week = 0;
    let autoBlocks = 0;
    let manualBlocks = 0;
    for (const e of this.entries) {
      if (e.t >= weekAgo) week += e.n || 1;
      autoBlocks += e.auto || 0;
      manualBlocks += e.manual || 0;
      const dn = e.deviceName || e.device || '—';
      byDevice.set(dn, (byDevice.get(dn) || 0) + 1);
      byAction.set(e.action, (byAction.get(e.action) || 0) + 1);
    }
    return {
      total: this.entries.length,
      week,
      autoBlocks,
      manualBlocks,
      byDevice: [...byDevice.entries()].sort((a, b) => b[1] - a[1]),
      byAction: [...byAction.entries()].sort((a, b) => b[1] - a[1]),
    };
  }
}

module.exports = { Journal, ACTION_LABELS };

  },
  "src/plugin.js": function (module, exports, require) {
'use strict';
/**
 * Ядро плагина: настройки, сканирование, команды, события.
 * main.js лишь загружает модули из src/ и передаёт сюда экземпляр Plugin (host).
 */

const { Notice, Platform, TFile, TFolder, Menu, debounce, normalizePath } = require('obsidian');
const { VIEW_TYPE, ICON, DEFAULT_SETTINGS } = require('./constants');
const { VaultSource, createFolderSource } = require('./io/sources');
const { scanAll, scanSource, isConflictPath, parseConflict } = require('./io/scanner');
const { ConflictActions } = require('./io/actions');
const { Bulk } = require('./io/bulk');
const { Journal, ACTION_LABELS } = require('./journal');
const { Stats, formatDuration } = require('./stats');
const { ConflictView } = require('./ui/view');
const { SettingsTab } = require('./settings');
const { confirm } = require('./ui/dom');
const { plural, formatDate } = require('./util');

class Core {
  constructor(host) {
    this.host = host;
    this.app = host.app;
    this.manifest = host.manifest;
    this.listeners = new Set();
    this.scan = null;
    this.scanning = false;
    this.pendingScan = false;
    this.knownCopies = null;
  }

  async onload() {
    const data = (await this.host.loadData()) || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
    this.settings.deviceNames = Object.assign({}, this.settings.deviceNames);
    this.settings.excludedFolders = [...(this.settings.excludedFolders || [])];
    this.settings.externalFolders = [...(this.settings.externalFolders || [])];
    this.journal = new Journal(this, data.journal);
    this.stats = new Stats(this, data.stats);
    this.actions = new ConflictActions(this);
    this.bulk = new Bulk(this);
    this.vaultSource = new VaultSource(this);

    const host = this.host;
    host.registerView(VIEW_TYPE, (leaf) => new ConflictView(leaf, this));
    this.ribbonEl = host.addRibbonIcon(ICON, 'Конфликты Syncthing', () => this.openView());
    this.ribbonEl.addClass('scr-ribbon');
    this.ribbonEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.ribbonMenu().showAtMouseEvent(e);
    });

    this.statusEl = host.addStatusBarItem();
    this.statusEl.addClass('scr-status', 'mod-clickable');
    this.statusEl.addEventListener('click', () => this.openView());
    this.updateStatus();

    host.addCommand({ id: 'open', name: 'Открыть конфликты', callback: () => this.openView() });
    host.addCommand({ id: 'rescan', name: 'Проверить конфликты заново', callback: () => this.rescan({ notifyEmpty: true }) });
    host.addCommand({ id: 'open-stats', name: 'Статистика конфликтов', callback: () => this.openView(null, 'stats') });
    host.addCommand({ id: 'check-folders', name: 'Проверить папки на устройстве', callback: () => this.checkAllFolders() });
    host.addCommand({ id: 'stats-note', name: 'Сохранить отчёт статистики в заметку', callback: () => this.writeStatsNote() });
    host.addCommand({ id: 'clean-identical', name: 'Убрать идентичные конфликтные копии', callback: () => this.cleanIdentical(true) });
    host.addCommand({
      id: 'resolve-active',
      name: 'Сверить конфликт текущего файла',
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        const hit = this.findForPath(f.path);
        if (!hit) return false;
        if (!checking) this.openView(hit);
        return true;
      },
    });

    host.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
      if (!(file instanceof TFile)) return;
      const hit = this.findForPath(file.path);
      if (!hit) return;
      menu.addItem((i) => i.setTitle('Сверить конфликт Syncthing').setIcon(ICON).onClick(() => this.openView(hit)));
    }));

    this.queueScan = debounce(() => this.rescan({ notify: true }), 1500, true);
    const onChange = (file, oldPath) => {
      if (!this.settings.autoScan || this.bulk.running) return;
      if (isConflictPath(file.path) || (oldPath && isConflictPath(oldPath))) this.queueScan();
    };
    host.registerEvent(this.app.vault.on('create', (f) => onChange(f)));
    host.registerEvent(this.app.vault.on('delete', (f) => onChange(f)));
    host.registerEvent(this.app.vault.on('rename', (f, old) => onChange(f, old)));

    host.addSettingTab(new SettingsTab(this));

    this.app.workspace.onLayoutReady(() => {
      window.setTimeout(() => this.rescan({ notify: true }), 2500);
    });
  }

  onunload() {
    this.listeners.clear();
  }

  /* ---------- данные ---------- */

  async saveData_() {
    await this.host.saveData({ settings: this.settings, journal: this.journal.entries, stats: this.stats.toJSON() });
  }

  async saveSettings() { await this.saveData_(); }

  async readReadme() {
    const p = `${this.manifest.dir}/README.md`;
    try {
      if (await this.app.vault.adapter.exists(p)) {
        const md = await this.app.vault.adapter.read(p);
        // Картинки README лежат в папке плагина — подставляем полный путь, чтобы они показались в настройках
        const adapter = this.app.vault.adapter;
        return md.replace(/!\[([^\]]*)\]\((screenshots\/[^)\s]+)\)/g, (m, alt, rel) => {
          try { return `![${alt}](${adapter.getResourcePath(`${this.manifest.dir}/${rel}`)})`; } catch (e) { return m; }
        });
      }
    } catch (e) { /* нет файла */ }
    // README не скопирован (установщик переносит только main.js, manifest.json, styles.css) —
    // берём текст, встроенный в main.js при сборке, без картинок
    const embedded = typeof globalThis.__SCR_README === 'string' ? globalThis.__SCR_README : null;
    if (embedded) return embedded.replace(/^!\[[^\]]*\]\(screenshots\/[^)]+\)\s*$/gm, '');
    return null;
  }

  deviceName(id) { return (this.settings.deviceNames && this.settings.deviceNames[id]) || id; }

  /** ID этого устройства: хранится локально и не синхронизируется. */
  localDeviceId() {
    if (this._deviceId) return this._deviceId;
    const KEY = 'scr-device-id';
    const load = () => (this.app.loadLocalStorage ? this.app.loadLocalStorage(KEY) : window.localStorage.getItem(KEY));
    let id = null;
    try { id = load(); } catch (e) { id = null; }
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      try {
        if (this.app.saveLocalStorage) this.app.saveLocalStorage(KEY, id);
        else window.localStorage.setItem(KEY, id);
      } catch (e) { /* без localStorage живём с временным ID */ }
    }
    this._deviceId = id;
    return id;
  }

  /** Папки, настроенные именно на этом устройстве. */
  foldersHere() {
    const me = this.localDeviceId();
    // Папки из прошлой версии (без привязки) были только десктопными
    return this.settings.externalFolders.filter((f) => f && f.path && (f.deviceId ? f.deviceId === me : Platform.isDesktopApp));
  }

  getSources() {
    const list = [this.vaultSource];
    for (const f of this.foldersHere()) {
      if (f.enabled === false) continue;
      const src = createFolderSource(this.app, f);
      if (src) list.push(src);
    }
    return list;
  }

  /** Проверить одну папку: доступ и число конфликтов (без изменения общего списка). */
  async checkFolder(folder) {
    const src = createFolderSource(this.app, folder);
    if (!src) return { ok: false, error: 'На этом устройстве папки вне хранилища недоступны' };
    const r = await scanSource(this, src);
    return r.status;
  }

  async checkAllFolders() {
    await this.rescan();
    if (!this.scan) return;
    const lines = this.scan.sources.map((s) => (s.ok
      ? `${s.label}: ${s.conflicts ? `${s.conflicts} ${plural(s.conflicts, 'конфликт', 'конфликта', 'конфликтов')}` : 'чисто'}`
      : `${s.label}: ${s.error}`));
    new Notice(`Проверка папок\n${lines.join('\n')}`, 8000);
  }

  ribbonMenu() {
    const m = new Menu();
    const n = this.conflictCount();
    m.addItem((i) => i.setTitle(n ? `Открыть конфликты (${n})` : 'Открыть конфликты').setIcon(ICON).onClick(() => this.openView()));
    m.addItem((i) => i.setTitle('Проверить сейчас').setIcon('refresh-cw').onClick(() => this.rescan({ notifyEmpty: true })));
    m.addItem((i) => i.setTitle('Проверить папки на устройстве').setIcon('folder-search').onClick(() => this.checkAllFolders()));
    m.addSeparator();
    m.addItem((i) => i.setTitle('Статистика').setIcon('bar-chart-3').onClick(() => this.openView(null, 'stats')));
    m.addItem((i) => i.setTitle('Журнал').setIcon('history').onClick(() => this.openView(null, 'journal')));
    m.addItem((i) => i.setTitle('Убрать идентичные копии').setIcon('copy-check').onClick(() => this.cleanIdentical(true)));
    return m;
  }

  /** Отчёт статистики в markdown-заметку. */
  async writeStatsNote() {
    const path = normalizePath(this.settings.statsNotePath || 'Syncthing/Статистика конфликтов.md');
    const all = this.stats.summary(null);
    const month = this.stats.summary(30);
    const row = (cells) => `| ${cells.join(' | ')} |`;
    const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
    const kinds = { text: 'Текст', image: 'Картинки', binary: 'Другие файлы' };
    const pct = (x) => (x === null ? '—' : `${Math.round(x * 100)}%`);
    const md = [
      '---',
      `updated: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      'tags:',
      '  - syncthing',
      '---',
      '# Статистика конфликтов Syncthing',
      '',
      `Обновлено: ${formatDate(Date.now())}`,
      '',
      table(['Показатель', 'За 30 дней', 'За всё время'], [
        ['Обнаружено конфликтов', month.detected, all.detected],
        ['Решено', month.resolved, all.resolved],
        ['Открыто сейчас', all.open, all.open],
        ['Медиана до решения', formatDuration(month.medianMs), formatDuration(all.medianMs)],
        ['Доля автослияния блоков', pct(month.autoRate), pct(all.autoRate)],
      ]),
      '',
      '## Устройства',
      '',
      all.byDevice.length ? table(['Устройство', 'Конфликтов'], all.byDevice) : '_нет данных_',
      '',
      '## Папки',
      '',
      all.byFolder.length ? table(['Папка', 'Конфликтов'], all.byFolder.slice(0, 15)) : '_нет данных_',
      '',
      '## Самые конфликтные файлы',
      '',
      all.topFiles.length ? table(['Файл', 'Конфликтов'], all.topFiles.map(([p, n]) => [`[[${p.replace(/\.md$/, '')}]]`, n])) : '_нет данных_',
      '',
      '## Как решались',
      '',
      all.byAction.length ? table(['Способ', 'Раз'], all.byAction.map(([a, n]) => [ACTION_LABELS[a] || a, n])) : '_нет данных_',
      '',
      '## Типы файлов',
      '',
      all.byKind.length ? table(['Тип', 'Конфликтов'], all.byKind.map(([k, n]) => [kinds[k] || k, n])) : '_нет данных_',
      '',
    ].join('\n');

    const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    if (dir && !(this.app.vault.getAbstractFileByPath(dir) instanceof TFolder)) {
      try { await this.app.vault.createFolder(dir); } catch (e) { /* папка уже есть */ }
    }
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) await this.app.vault.modify(existing, md);
    else await this.app.vault.create(path, md);
    new Notice(`Отчёт сохранён: ${path}`);
    await this.app.workspace.openLinkText(path, '', 'tab');
  }

  /* ---------- сканирование ---------- */

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.updateStatus();
    for (const fn of this.listeners) {
      try { fn(); } catch (e) { console.error('[Syncthing Conflict Resolver]', e); }
    }
  }

  /** Лёгкое уведомление о ходе анализа или массового действия — без полной перерисовки. */
  emitProgress() {
    for (const fn of this.listeners) {
      try { fn('progress'); } catch (e) { console.error('[Syncthing Conflict Resolver]', e); }
    }
  }

  conflictCount() {
    return this.scan ? this.scan.groups.reduce((n, g) => n + g.copies.length, 0) : 0;
  }

  updateStatus() {
    const n = this.conflictCount();
    if (this.ribbonEl) {
      this.ribbonEl.dataset.count = n > 999 ? `${Math.floor(n / 1000)}k` : String(n);
      this.ribbonEl.setAttr('aria-label', n ? `Конфликты Syncthing: ${n}` : 'Конфликты Syncthing');
    }
    if (!this.statusEl) return;
    this.statusEl.empty();
    this.statusEl.toggleClass('is-hidden', n === 0);
    if (n) {
      this.statusEl.setText(`⇄ ${n.toLocaleString('ru-RU')} ${plural(n, 'конфликт', 'конфликта', 'конфликтов')}`);
      this.statusEl.setAttr('aria-label', 'Открыть конфликты Syncthing');
    }
  }

  async rescan(opts = {}) {
    if (this.scanning) { this.pendingScan = true; return; }
    this.scanning = true;
    this.emit();
    try {
      const result = await scanAll(this);
      this.scan = result;
      if (this.stats.recordScan(result)) await this.saveData_();
      this.scanning = false;
      this.emit();

      // Классификация всех копий: идентичные, невидимые отличия, только свойства, автослияние…
      await this.bulk.analyze(result);

      const keys = new Set(result.groups.flatMap((g) => g.copies.map((c) => `${g.source.id}::${c.path}`)));
      if (opts.notify && this.settings.notifyNew && this.knownCopies) {
        const fresh = [...keys].filter((k) => !this.knownCopies.has(k)).length;
        if (fresh) this.notice(`Syncthing: ${fresh} ${plural(fresh, 'новый конфликт', 'новых конфликта', 'новых конфликтов')}. Нажмите, чтобы разобрать.`);
      } else if (opts.notify && this.settings.notifyNew && !this.knownCopies && keys.size) {
        this.notice(`Syncthing: ${keys.size} ${plural(keys.size, 'конфликт ждёт', 'конфликта ждут', 'конфликтов ждут')} решения.`);
      }
      if (opts.notifyEmpty && !keys.size) new Notice('Конфликтов нет');
      this.knownCopies = keys;
    } catch (e) {
      console.error('[Syncthing Conflict Resolver]', e);
      new Notice(`Ошибка проверки: ${e.message}`);
    } finally {
      this.scanning = false;
      if (this.pendingScan) {
        this.pendingScan = false;
        this.rescan(opts);
      } else {
        this.emit();
      }
    }
  }

  notice(text) {
    const n = new Notice(text, 10000);
    const el = n.noticeEl || n.containerEl || n.messageEl;
    if (el) el.addEventListener('click', () => this.openView());
  }

  /** Конфликт для файла: сам исходный файл или его конфликтная копия. */
  findForPath(path) {
    if (!this.scan) return null;
    const parsed = parseConflict(path);
    for (const g of this.scan.groups) {
      if (g.source.kind !== 'vault') continue;
      if (g.path === path) return { group: g, copy: g.copies[0] };
      if (parsed && g.path === parsed.original) {
        const c = g.copies.find((x) => x.path === path);
        if (c) return { group: g, copy: c };
      }
    }
    return null;
  }

  async cleanIdentical(ask) {
    if (!this.scan || !this.scan.analysis || !this.scan.analysis.done) await this.rescan();
    if (!this.scan) return 0;
    const n = this.bulk.items('identical').length + this.bulk.items('whitespace').length;
    if (!n) { new Notice('Идентичных копий нет'); return 0; }
    if (ask) {
      const ok = await confirm(this.app, {
        title: 'Убрать идентичные копии?',
        text: `${n} ${plural(n, 'копия совпадает', 'копии совпадают', 'копий совпадают')} с текущими файлами (байт в байт или с точностью до невидимых символов). Текущие файлы не меняются.`,
        confirm: 'Убрать',
      });
      if (!ok) return null;
    }
    const a = await this.bulk.run('identical', 'remove');
    const b = await this.bulk.run('whitespace', 'remove');
    new Notice(`Убрано копий: ${a.ok + b.ok}${a.failed + b.failed ? `, ошибок: ${a.failed + b.failed}` : ''}`);
    await this.rescan();
    return a.ok + b.ok;
  }

  /* ---------- окно ---------- */

  async openView(hit, tab) {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = ws.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    ws.revealLeaf(leaf);
    const view = leaf.view;
    if (hit && view && view.openMerge) await view.openMerge(hit.group, hit.copy);
    else if (tab && view && view.setTab) view.setTab(tab);
    return view;
  }
}

module.exports = { Core };

  },
  "src/settings.js": function (module, exports, require) {
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

  },
  "src/stats.js": function (module, exports, require) {
'use strict';
/**
 * Статистика конфликтов.
 *  detected — каждая конфликтная копия, впервые замеченная при сканировании
 *  журнал   — каждое решение (см. journal.js)
 * Вместе они дают: сколько появилось, сколько решено, за сколько, откуда и где.
 */

const { dirname, pad } = require('./util');

const DAY = 864e5;
const MAX_DETECTED = 3000;
const MASS_THRESHOLD = 200; // больше новых копий за один скан — пишем сводными записями

/** Короткий хэш ключа копии (FNV-1a), чтобы список «уже видели» не раздувал data.json. */
function hashKey(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}

function dayKey(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function countBy(list, keyFn) {
  const m = new Map();
  for (const x of list) {
    const k = keyFn(x);
    if (k === null || k === undefined) continue;
    m.set(k, (m.get(k) || 0) + (x.n || 1));
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function median(nums) {
  if (!nums.length) return null;
  const s = nums.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function formatDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} мин`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} ч`;
  return `${Math.round(h / 24)} дн`;
}

class Stats {
  constructor(core, data) {
    this.core = core;
    this.detected = data && Array.isArray(data.detected) ? data.detected : [];
    this.seen = new Set(data && Array.isArray(data.seen) ? data.seen : []);
  }

  toJSON() {
    return { detected: this.detected, seen: [...this.seen] };
  }

  /**
   * Учесть результат сканирования. Новые копии попадают в detected;
   * исчезнувшие (решённые) забываются — но только у папок, которые просканировались без ошибок.
   */
  recordScan(scan) {
    const allOk = (scan.sources || []).every((s) => s.ok);
    const current = new Set();
    const fresh = [];
    for (const g of scan.groups) {
      for (const c of g.copies) {
        const key = hashKey(`${g.source.id}::${c.path}`);
        current.add(key);
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        fresh.push({
          t: Date.now(),
          copyTime: c.time.getTime(),
          path: g.path,
          folder: dirname(g.path) || '/',
          device: c.device,
          source: g.source.label,
          kind: g.kind,
        });
      }
    }

    if (fresh.length > MASS_THRESHOLD) {
      // Массовый наплыв: одна запись на (устройство, папка, тип) с количеством
      const agg = new Map();
      for (const e of fresh) {
        const k = `${e.device}|${e.source}|${e.folder}|${e.kind}`;
        const a = agg.get(k);
        if (a) { a.n++; a.copyTime = Math.min(a.copyTime, e.copyTime); } else agg.set(k, { ...e, path: null, n: 1, mass: true });
      }
      this.detected.unshift(...agg.values());
    } else {
      this.detected.unshift(...fresh);
    }

    // Решённые копии забываем, только если все папки просканировались без ошибок
    if (allOk) for (const key of [...this.seen]) if (!current.has(key)) this.seen.delete(key);
    if (this.detected.length > MAX_DETECTED) this.detected.length = MAX_DETECTED;
    return fresh.length;
  }

  clear() {
    this.detected = [];
    this.core.journal.entries = [];
  }

  /**
   * Сводка за период.
   * @param {number|null} days — 7, 30, 90 или null (всё время)
   */
  summary(days) {
    const core = this.core;
    const since = days ? Date.now() - days * DAY : 0;
    const D = this.detected.filter((e) => e.t >= since);
    const J = core.journal.entries.filter((e) => e.t >= since);

    const durations = J.filter((e) => e.copyTime).map((e) => e.t - e.copyTime).filter((x) => x >= 0);
    let autoBlocks = 0;
    let manualBlocks = 0;
    for (const e of J) { autoBlocks += e.auto || 0; manualBlocks += e.manual || 0; }

    // Ряды по дням
    const span = days || Math.min(365, Math.max(7, Math.ceil((Date.now() - Math.min(
      ...D.map((e) => e.t), ...J.map((e) => e.t), Date.now(),
    )) / DAY) + 1));
    const series = [];
    const idx = new Map();
    for (let i = span - 1; i >= 0; i--) {
      const t = Date.now() - i * DAY;
      const k = dayKey(t);
      idx.set(k, series.length);
      series.push({ key: k, date: new Date(t), detected: 0, resolved: 0 });
    }
    for (const e of D) { const i = idx.get(dayKey(e.t)); if (i !== undefined) series[i].detected += e.n || 1; }
    for (const e of J) { const i = idx.get(dayKey(e.t)); if (i !== undefined) series[i].resolved += e.n || 1; }

    const devName = (id) => core.deviceName(id);
    return {
      detected: D.reduce((n, e) => n + (e.n || 1), 0),
      resolved: J.reduce((n, e) => n + (e.n || 1), 0),
      open: core.conflictCount(),
      medianMs: median(durations),
      avgMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
      autoBlocks,
      manualBlocks,
      autoRate: autoBlocks + manualBlocks ? autoBlocks / (autoBlocks + manualBlocks) : null,
      series,
      byDevice: countBy(D, (e) => devName(e.device)),
      byFolder: countBy(D, (e) => (e.source && e.source !== 'Хранилище' ? `${e.source} › ${e.folder}` : e.folder)),
      topFiles: countBy(D.filter((e) => e.path), (e) => e.path).slice(0, 10),
      byKind: countBy(D, (e) => e.kind),
      byAction: countBy(J, (e) => e.action),
      byWeekday: countBy(D, (e) => (new Date(e.t).getDay() + 6) % 7),
    };
  }
}

module.exports = { Stats, formatDuration, dayKey };

  },
  "src/ui/bulk-panel.js": function (module, exports, require) {
'use strict';
/**
 * Панель «Умный разбор» на вкладке «Конфликты»: что за конфликты, сколько их, как разобрать пачкой.
 */

const { CATEGORIES, CATEGORY_ORDER } = require('../io/bulk');
const { plural } = require('../util');
const { button, icon } = require('./dom');

/** Категории, которые разбираются без потери данных. */
const SAFE = [
  ['identical', 'remove'],
  ['whitespace', 'remove'],
  ['current-newer', 'remove'],
  ['copy-newer', 'take'],
  ['auto', 'merge'],
];

const fmt = (n) => n.toLocaleString('ru-RU');

function eta(state) {
  const elapsed = Date.now() - state.started;
  if (!state.done || elapsed < 1500) return '';
  const left = (elapsed / state.done) * (state.total - state.done);
  const s = Math.round(left / 1000);
  if (s < 60) return ` · осталось ~${s} с`;
  return ` · осталось ~${Math.round(s / 60)} мин`;
}

function renderProgress(view, parent) {
  const st = view.core.bulk.state;
  const box = parent.createDiv('scr-bulk scr-bulk-running');
  const head = box.createDiv('scr-bulk-head');
  icon(head.createDiv('scr-bulk-ico is-spinning'), 'loader');
  const t = head.createDiv('scr-bulk-title');
  t.createDiv({ cls: 'scr-bulk-name', text: st.label });
  t.createDiv({ cls: 'scr-bulk-sub', attr: { 'data-bulk-text': '' }, text: `${fmt(st.done)} из ${fmt(st.total)}${eta(st)}` });
  button(head, { text: 'Остановить', icon: 'x', variant: 'ghost', onClick: () => view.core.bulk.cancel() });
  const track = box.createDiv('scr-progress-track scr-bulk-track');
  const fill = track.createDiv({ cls: 'scr-progress-fill', attr: { 'data-bulk-fill': '' } });
  fill.style.width = `${st.total ? (st.done / st.total) * 100 : 0}%`;
}

/** Обновление полосы прогресса без перерисовки страницы. */
function updateProgress(root, core) {
  const st = core.bulk.state;
  if (!st) return false;
  const fill = root.querySelector('[data-bulk-fill]');
  const text = root.querySelector('[data-bulk-text]');
  if (!fill || !text) return false;
  fill.style.width = `${st.total ? (st.done / st.total) * 100 : 0}%`;
  text.setText(`${fmt(st.done)} из ${fmt(st.total)}${eta(st)}`);
  return true;
}

function renderBulkPanel(view, parent, scan) {
  const core = view.core;
  if (core.bulk.state) { renderProgress(view, parent); return; }
  const a = scan.analysis;
  const total = scan.groups.reduce((n, g) => n + g.copies.length, 0);
  if (!total) return;

  if (!a || !a.done) {
    const box = parent.createDiv('scr-bulk');
    const head = box.createDiv('scr-bulk-head');
    icon(head.createDiv('scr-bulk-ico'), 'sparkles');
    const t = head.createDiv('scr-bulk-title');
    t.createDiv({ cls: 'scr-bulk-name', text: 'Умный разбор' });
    t.createDiv({ cls: 'scr-bulk-sub', text: a ? `Анализ остановлен: ${fmt(a.analyzed || 0)} из ${fmt(a.total)}` : 'Копии ещё не проанализированы' });
    button(head, { text: 'Проанализировать', icon: 'sparkles', variant: 'primary', onClick: () => core.bulk.analyze(scan) });
    return;
  }

  const counts = a.counts;
  const safeCount = SAFE.reduce((n, [c]) => n + (counts[c] || 0), 0);
  const manual = total - safeCount;

  const box = parent.createDiv('scr-bulk');
  const head = box.createDiv('scr-bulk-head');
  icon(head.createDiv('scr-bulk-ico'), 'sparkles');
  const t = head.createDiv('scr-bulk-title');
  t.createDiv({ cls: 'scr-bulk-name', text: 'Умный разбор' });
  t.createDiv({
    cls: 'scr-bulk-sub',
    text: safeCount
      ? `${fmt(safeCount)} из ${fmt(total)} можно разобрать без потери данных${manual ? `, ${fmt(manual)} — посмотреть` : ''}`
      : `Все ${fmt(total)} требуют решения`,
  });
  if (safeCount) {
    button(head, {
      text: `Разобрать безопасные (${fmt(safeCount)})`, icon: 'check-check', variant: 'primary',
      onClick: () => view.runSafe(SAFE),
    });
  }

  const renamed = scan.groups.filter((g) => g.renamedFrom).reduce((n, g) => n + g.copies.length, 0);
  if (renamed) {
    const note = box.createDiv('scr-banner scr-bulk-note');
    icon(note, 'file-input');
    note.createSpan({
      text: `${fmt(renamed)} ${plural(renamed, 'копия относится', 'копии относятся', 'копий относятся')} к переименованным файлам: под старым именем файла уже нет, зато он нашёлся под новым. Такие копии сравниваются с новым файлом, восстанавливать старые имена не нужно.`,
    });
  }

  const rows = box.createDiv('scr-bulk-rows');
  for (const cat of CATEGORY_ORDER) {
    const n = counts[cat] || 0;
    if (!n) continue;
    const meta = CATEGORIES[cat];
    const row = rows.createDiv({ cls: ['scr-bulk-row', `is-${meta.tone}`].concat(view.listState.filter === cat ? ['is-active'] : []) });
    icon(row.createDiv('scr-bulk-row-ico'), meta.ico);
    const body = row.createDiv('scr-bulk-row-body');
    const line = body.createDiv('scr-bulk-row-line');
    line.createSpan({ cls: 'scr-bulk-row-name', text: meta.label });
    line.createSpan({ cls: 'scr-bulk-row-count', text: fmt(n) });
    if (SAFE.some(([c]) => c === cat)) line.createSpan({ cls: 'scr-chip scr-chip-ok', text: 'безопасно' });
    body.createDiv({ cls: 'scr-bulk-row-hint', text: meta.hint });
    body.addEventListener('click', () => {
      view.listState.filter = view.listState.filter === cat ? 'all' : cat;
      view.listState.limit = 50;
      view.rerender(false);
    });
    body.setAttr('title', 'Показать эти копии в списке');
    const acts = row.createDiv('scr-bulk-row-actions');
    for (const act of meta.actions) {
      button(acts, {
        text: act.text, variant: act.primary ? 'soft' : 'ghost',
        onClick: () => view.runBulk(cat, act.id),
      });
    }
  }
  if (a.ms) box.createDiv({ cls: 'scr-bulk-foot', text: `Проанализировано ${fmt(a.total)} ${plural(a.total, 'копия', 'копии', 'копий')} за ${(a.ms / 1000).toFixed(1)} с` });
}

module.exports = { renderBulkPanel, updateProgress, SAFE };

  },
  "src/ui/dom.js": function (module, exports, require) {
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

  },
  "src/ui/journal-tab.js": function (module, exports, require) {
'use strict';
/**
 * Вкладка «Журнал»: хронология решений. Сводные цифры — на вкладке «Статистика».
 */

const { ACTION_LABELS } = require('../journal');
const { formatDate } = require('../util');
const { formatDuration } = require('../stats');
const { button, icon, chip, emptyState, avatar } = require('./dom');

const ACTION_ICON = { merge: 'git-merge', keep: 'file-check', take: 'file-input', both: 'files', identical: 'copy-check' };

function renderJournalTab(view, el) {
  const core = view.core;
  const entries = core.journal.entries;
  const page = el.createDiv('scr-journal');

  if (!entries.length) {
    emptyState(page, { ico: 'history', title: 'Журнал пуст', text: 'Здесь появятся решённые конфликты.' });
    return;
  }

  const head = page.createDiv('scr-section-head');
  head.createDiv({ cls: 'scr-panel-title', text: `Последние действия · ${entries.length}` });
  button(head, { text: 'Статистика', icon: 'bar-chart-3', variant: 'ghost', onClick: () => view.setTab('stats') });

  const list = page.createDiv('scr-log');
  for (const e of entries.slice(0, 200)) {
    const row = list.createDiv('scr-log-row');
    icon(row.createDiv(`scr-log-ico scr-log-${e.action}`), ACTION_ICON[e.action] || 'dot');
    const body = row.createDiv('scr-log-body');
    body.createDiv({ cls: 'scr-log-path', text: e.path });
    const meta = body.createDiv('scr-log-meta');
    meta.createSpan({ text: ACTION_LABELS[e.action] || e.action });
    if (e.action === 'merge') meta.createSpan({ text: ` · авто ${e.auto || 0}, вручную ${e.manual || 0}${e.base ? ', с базой' : ''}` });
    if (e.copyTime) meta.createSpan({ text: ` · решено через ${formatDuration(e.t - e.copyTime)}` });
    if (e.target) meta.createSpan({ text: ` → ${e.target}` });
    const right = row.createDiv('scr-log-right');
    const dev = right.createDiv('scr-log-dev');
    avatar(dev, e.deviceName || e.device || '?', e.device);
    dev.createSpan({ text: core.deviceName(e.device) || e.deviceName || '—' });
    right.createDiv({ cls: 'scr-muted', text: formatDate(e.t) });
    if (e.source && e.source !== 'Хранилище') chip(right, e.source, 'muted');
  }
}

module.exports = { renderJournalTab };

  },
  "src/ui/list-tab.js": function (module, exports, require) {
'use strict';
/**
 * Вкладка «Конфликты»: сводка, фильтры, карточки файлов с копиями, массовые действия.
 */

const { Menu, Notice } = require('obsidian');
const { formatDate, formatSize, relativeAge, plural, basename } = require('../util');
const { button, icon, chip, statCard, emptyState, avatar } = require('./dom');
const { CATEGORIES, CATEGORY_ORDER } = require('../io/bulk');
const { renderBulkPanel, SAFE } = require('./bulk-panel');

const PAGE = 50;
const CHIP_TONE = { ok: 'ok', info: 'manual', warn: 'conflict', conflict: 'conflict' };

const KIND_ICON = { text: 'file-text', image: 'image', binary: 'file' };

function copyKey(group, copy) { return `${group.source.id}::${copy.path}`; }

function matches(group, state) {
  if (state.source && group.source.id !== state.source) return false;
  const q = state.query.trim().toLowerCase();
  if (q && !group.path.toLowerCase().includes(q)) return false;
  if (state.filter && state.filter !== 'all') return group.copies.some((c) => c.category === state.filter);
  return true;
}

function renderListTab(view, el) {
  const core = view.core;
  const scan = core.scan;
  const state = view.listState;

  if (!scan) {
    emptyState(el, { ico: 'loader', title: 'Ищу конфликты…' });
    return;
  }

  const groups = scan.groups;
  const copies = groups.reduce((n, g) => n + g.copies.length, 0);
  const devices = new Set(groups.flatMap((g) => g.copies.map((c) => c.device)));
  const counts = (scan.analysis && scan.analysis.counts) || {};
  const analyzed = scan.analysis && scan.analysis.done;
  const safe = SAFE.reduce((n, [c]) => n + (counts[c] || 0), 0);
  const fmt = (n) => n.toLocaleString('ru-RU');

  const page = el.createDiv('scr-list');

  const stats = page.createDiv('scr-stats');
  statCard(stats, { label: 'Конфликтных копий', value: fmt(copies), ico: 'git-merge', variant: copies ? 'warn' : 'ok', hint: copies ? `в ${fmt(groups.length)} ${plural(groups.length, 'файле', 'файлах', 'файлах')}` : 'всё чисто' });
  statCard(stats, { label: 'Разберутся сами', value: analyzed ? fmt(safe) : '…', ico: 'check-check', variant: safe ? 'ok' : null, hint: analyzed ? 'без потери данных' : 'анализирую' });
  statCard(stats, { label: 'Нужна сверка', value: analyzed ? fmt(counts.conflict || 0) : '…', ico: 'git-compare', variant: counts.conflict ? 'warn' : null, hint: analyzed ? 'встречные правки' : null });
  statCard(stats, { label: 'Устройств', value: devices.size, ico: 'smartphone' });

  renderSources(view, page, scan);
  if (groups.length) renderBulkPanel(view, page, scan);

  if (!groups.length) {
    emptyState(page, {
      ico: 'check-circle-2',
      title: 'Конфликтов нет',
      text: `Последняя проверка: ${formatDate(scan.scannedAt)}`,
      action: { text: 'Проверить снова', icon: 'refresh-cw', onClick: () => core.rescan() },
    });
    return;
  }

  // Панель фильтров
  const tb = page.createDiv('scr-toolbar');
  const search = tb.createDiv('scr-search');
  icon(search, 'search');
  const input = search.createEl('input', { type: 'search', placeholder: 'Поиск по пути…' });
  input.value = state.query;
  input.addEventListener('input', () => {
    state.query = input.value;
    view.rerender(false, () => {
      const i = view.bodyEl.querySelector('.scr-search input');
      if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    });
  });
  const seg = tb.createDiv('scr-seg');
  const filters = [['all', `Все ${fmt(copies)}`]].concat(CATEGORY_ORDER.filter((c) => counts[c]).map((c) => [c, `${CATEGORIES[c].label} ${fmt(counts[c])}`]));
  if (state.filter !== 'all' && !counts[state.filter]) state.filter = 'all';
  for (const [key, label] of filters) {
    const b = seg.createEl('button', { text: label, cls: state.filter === key ? 'is-active' : '' });
    b.addEventListener('click', () => { state.filter = key; state.limit = PAGE; view.rerender(false); });
  }

  // Панель выделения
  const visible = groups.filter((g) => matches(g, state));
  const selected = [];
  for (const g of groups) for (const c of g.copies) if (state.selected.has(copyKey(g, c))) selected.push([g, c]);
  if (selected.length) {
    const sb = page.createDiv('scr-selbar');
    sb.createSpan({ cls: 'scr-selbar-count', text: `Выбрано: ${selected.length}` });
    button(sb, { text: 'Оставить текущие', icon: 'file-check', variant: 'soft', onClick: () => view.bulk('keep', selected) });
    button(sb, { text: 'Взять копии', icon: 'file-input', variant: 'soft', onClick: () => view.bulk('take', selected) });
    button(sb, { text: 'Оставить обе', icon: 'files', variant: 'soft', onClick: () => view.bulk('both', selected) });
    button(sb, { icon: 'x', title: 'Снять выделение', variant: 'ghost', onClick: () => { state.selected.clear(); view.rerender(); } });
  }

  const list = page.createDiv('scr-groups');
  if (!visible.length) {
    list.createDiv({ cls: 'scr-muted scr-pad', text: 'Под фильтр ничего не попало.' });
  }

  const limit = state.limit || PAGE;
  for (const g of visible.slice(0, limit)) {
    const card = list.createDiv('scr-group');
    const head = card.createDiv('scr-group-head');

    const allSel = g.copies.every((c) => state.selected.has(copyKey(g, c)));
    const cb = head.createEl('input', { type: 'checkbox', cls: 'scr-check' });
    cb.checked = allSel;
    cb.addEventListener('change', () => {
      for (const c of g.copies) {
        if (cb.checked) state.selected.add(copyKey(g, c));
        else state.selected.delete(copyKey(g, c));
      }
      view.rerender();
    });

    icon(head.createDiv(`scr-kind scr-kind-${g.kind}`), KIND_ICON[g.kind] || 'file');
    const title = head.createDiv('scr-group-title');
    title.createDiv({ cls: 'scr-group-name', text: g.name });
    const path = title.createDiv('scr-group-path');
    path.setText(g.path);
    const badges = head.createDiv('scr-badges');
    if (g.source.kind !== 'vault') chip(badges, g.source.label, 'muted', 'folder-open');
    if (!g.exists) chip(badges, 'исходный удалён', 'conflict', 'file-x');
    if (g.renamedFrom) {
      const rc = chip(badges, `было: ${basename(g.renamedFrom)}`, 'manual', 'file-input');
      rc.setAttr('title', `Исходный файл переименован: ${g.renamedFrom} → ${g.path}. Копии сравниваются с новым файлом.`);
    }
    if (g.versions.length) chip(badges, `база: ${g.versions.length}`, 'auto', 'history');
    if (g.copies.length > 1) chip(badges, `${g.copies.length} ${plural(g.copies.length, 'копия', 'копии', 'копий')}`, 'muted');

    const rows = card.createDiv('scr-copies');
    for (const c of g.copies) {
      const r = rows.createDiv('scr-copy');
      const ccb = r.createEl('input', { type: 'checkbox', cls: 'scr-check' });
      ccb.checked = state.selected.has(copyKey(g, c));
      ccb.addEventListener('change', () => {
        if (ccb.checked) state.selected.add(copyKey(g, c));
        else state.selected.delete(copyKey(g, c));
        view.rerender();
      });
      const name = core.deviceName(c.device);
      avatar(r, name, c.device);
      const info = r.createDiv('scr-copy-info');
      const line1 = info.createDiv('scr-copy-dev');
      line1.createSpan({ text: name });
      if (name !== c.device) line1.createSpan({ cls: 'scr-muted', text: c.device });
      const line2 = info.createDiv('scr-copy-meta');
      line2.setText(`${formatDate(c.time)} · ${relativeAge(c.time)}`);
      if (c.size !== null && g.size !== null) {
        const d = c.size - g.size;
        line2.appendText(` · ${formatSize(c.size)}`);
        if (d) line2.createSpan({ cls: d > 0 ? 'scr-plus' : 'scr-minus', text: ` ${d > 0 ? '+' : '−'}${formatSize(Math.abs(d))}` });
      }
      const tags = r.createDiv('scr-badges');
      if (c.category) {
        const meta = CATEGORIES[c.category];
        const ch = chip(tags, meta.label.toLowerCase(), CHIP_TONE[meta.tone], meta.ico);
        if (c.detail) ch.setAttr('title', c.detail);
      } else chip(tags, '…', 'muted');

      const act = r.createDiv('scr-copy-actions');
      if (c.category === 'identical' || c.category === 'whitespace') {
        button(act, { text: 'Убрать', icon: 'trash-2', variant: 'soft', onClick: () => view.runFor(g, c, 'identical') });
      } else {
        button(act, { text: g.exists ? 'Сверить' : 'Разобрать', icon: 'git-compare', variant: 'primary', onClick: () => view.openMerge(g, c) });
      }
      button(act, {
        icon: 'more-vertical', title: 'Ещё', variant: 'ghost',
        onClick: (e) => {
          const m = new Menu();
          m.addItem((i) => i.setTitle('Сверить').setIcon('git-compare').onClick(() => view.openMerge(g, c)));
          m.addSeparator();
          m.addItem((i) => i.setTitle(g.exists ? 'Оставить текущую' : 'Удалить копию').setIcon('file-check').onClick(() => view.runFor(g, c, 'keep')));
          m.addItem((i) => i.setTitle(g.exists ? 'Взять копию' : 'Восстановить из копии').setIcon('file-input').onClick(() => view.runFor(g, c, 'take')));
          if (g.exists) m.addItem((i) => i.setTitle('Оставить обе').setIcon('files').onClick(() => view.runFor(g, c, 'both')));
          if (g.source.openable(c.path)) {
            m.addSeparator();
            m.addItem((i) => i.setTitle('Открыть копию').setIcon('external-link').onClick(() => core.app.workspace.openLinkText(c.path, '', 'tab')));
          }
          m.showAtMouseEvent(e);
        },
      });
    }
  }

  if (visible.length > limit) {
    const more = page.createDiv('scr-more');
    more.createSpan({ cls: 'scr-muted', text: `Показано ${fmt(limit)} из ${fmt(visible.length)} ${plural(visible.length, 'файла', 'файлов', 'файлов')}` });
    button(more, { text: `Показать ещё ${Math.min(PAGE * 4, visible.length - limit)}`, icon: 'chevron-down', variant: 'soft', onClick: () => { state.limit = limit + PAGE * 4; view.rerender(true); } });
  }
}

/** Полоса проверенных папок: хранилище и папки на устройстве, с состоянием и числом конфликтов. */
function renderSources(view, page, scan) {
  const sources = scan.sources || [];
  if (sources.length < 2 && sources.every((s) => s.ok)) return;
  const state = view.listState;
  const strip = page.createDiv('scr-sources');
  const head = strip.createDiv('scr-sources-head');
  icon(head, 'folder-search');
  head.createSpan({ text: 'Проверенные папки' });
  button(head, {
    text: 'Добавить папку', icon: 'folder-plus', variant: 'ghost',
    onClick: () => { view.app.setting.open(); view.app.setting.openTabById(view.core.manifest.id); },
  });
  const row = strip.createDiv('scr-sources-row');
  for (const s of sources) {
    const card = row.createDiv({ cls: ['scr-source'].concat(s.ok ? [] : ['is-error']).concat(state.source === s.id ? ['is-active'] : []) });
    icon(card.createDiv('scr-source-ico'), s.kind === 'vault' ? 'vault' : s.ok ? 'folder' : 'folder-x');
    const body = card.createDiv('scr-source-body');
    body.createDiv({ cls: 'scr-source-name', text: s.label });
    const meta = body.createDiv('scr-source-meta');
    if (!s.ok) meta.setText(s.error);
    else meta.setText(`${s.files.toLocaleString('ru-RU')} ${plural(s.files, 'файл', 'файла', 'файлов')} · ${s.ms < 1000 ? `${s.ms} мс` : `${(s.ms / 1000).toFixed(1)} с`}`);
    if (s.ok) {
      card.createDiv({ cls: ['scr-source-count'].concat(s.conflicts ? ['is-warn'] : []), text: s.conflicts.toLocaleString('ru-RU') });
      card.addEventListener('click', () => {
        state.source = state.source === s.id ? null : s.id;
        view.rerender();
      });
      card.setAttr('title', state.source === s.id ? 'Показать все папки' : 'Показать конфликты только этой папки');
    }
  }
}

module.exports = { renderListTab, copyKey };

  },
  "src/ui/merge-session.js": function (module, exports, require) {
'use strict';
/**
 * Состояние одной сверки: тексты, база, модель блоков, развёрнутые участки.
 * Без DOM — только данные.
 */

const { buildModel, assemble, stats } = require('../core/merge');
const { pickBase } = require('../io/scanner');
const { looksBinary } = require('../util');

class MergeSession {
  constructor(core, group, copy) {
    this.core = core;
    this.group = group;
    this.copy = copy;
    this.loading = true;
    this.error = null;
    this.mode = 'text'; // text | binary | missing
    this.baseChoice = core.settings.autoBase ? 'auto' : 'none';
    this.baseVersion = null;
    this.baseText = null;
    this.baseWarning = null;
    this.model = null;
    this.expanded = new Set();
    this.editing = null;
    this.blobUrls = [];
  }

  async load() {
    const { group, copy } = this;
    const src = group.source;
    try {
      this.copyStat = await src.stat(copy.path);
      this.origStat = group.exists ? await src.stat(group.path) : null;

      if (!group.exists) {
        this.mode = 'missing';
        if (group.kind === 'text') this.rightText = await src.read(copy.path);
        return;
      }
      if (group.kind !== 'text') { this.mode = 'binary'; return; }

      const [lb, rb] = await Promise.all([src.readBinary(group.path), src.readBinary(copy.path)]);
      if (looksBinary(lb) || looksBinary(rb)) { this.mode = 'binary'; return; }

      this.leftText = await src.read(group.path);
      this.rightText = await src.read(copy.path);
      await this.applyBase(this.baseChoice);
    } catch (e) {
      console.error('[Syncthing Conflict Resolver]', e);
      this.error = e.message || String(e);
    } finally {
      this.loading = false;
    }
  }

  async applyBase(choice) {
    const { group, copy } = this;
    this.baseChoice = choice;
    let ver = null;
    if (choice === 'auto') ver = pickBase(group, copy);
    else if (choice !== 'none') ver = group.versions.find((v) => v.path === choice) || null;
    this.baseVersion = ver;
    this.baseText = null;
    if (ver) {
      try { this.baseText = await ver.source.read(ver.path); } catch (e) { this.baseVersion = null; }
    }
    const norm = (t) => (t || '').replace(/\r\n/g, '\n');
    this.baseWarning = null;
    if (this.baseText !== null) {
      if (norm(this.baseText) === norm(this.leftText)) this.baseWarning = 'left';
      else if (norm(this.baseText) === norm(this.rightText)) this.baseWarning = 'right';
    }
    const s = this.core.settings;
    this.model = buildModel({
      left: this.leftText,
      right: this.rightText,
      base: this.baseText,
      ignoreTrailingWhitespace: s.ignoreTrailingWhitespace,
      mergeProperties: s.mergeProperties,
    });
    this.expanded.clear();
    this.editing = null;
  }

  changes() { return this.model ? this.model.chunks.filter((c) => c.type === 'change') : []; }
  stats() { return this.model ? stats(this.model) : { total: 0, auto: 0, unresolved: 0, manual: 0 }; }
  result() { return this.model ? assemble(this.model) : null; }

  hasManualDecisions() {
    return this.changes().some((c) => c.decision !== null && c.decision !== (c.auto === 'same' ? 'left' : c.auto));
  }

  decide(chunk, decision) {
    chunk.decision = decision;
    if (decision !== 'custom') this.editing = null;
  }

  resetChunk(chunk) {
    chunk.decision = chunk.auto === 'same' ? 'left' : chunk.auto;
    chunk.custom = null;
    this.editing = null;
  }

  decideAllUnresolved(decision) {
    for (const c of this.changes()) if (c.decision === null) c.decision = decision;
  }

  trackBlob(url) { this.blobUrls.push(url); return url; }

  dispose() {
    for (const u of this.blobUrls) URL.revokeObjectURL(u);
    this.blobUrls = [];
  }
}

module.exports = { MergeSession };

  },
  "src/ui/merge-tab.js": function (module, exports, require) {
'use strict';
/**
 * Вкладка «Сверка»: три колонки как в Android Studio —
 * текущая версия | результат | конфликтная копия.
 * На узком экране колонки складываются в стопку.
 */

const { Menu, Platform } = require('obsidian');
const { wordDiff } = require('../core/diff');
const { resultLines } = require('../core/merge');
const { formatDate, formatSize, relativeAge, plural, mimeOf } = require('../util');
const { button, icon, chip, emptyState, avatar, confirm } = require('./dom');

/* ---------- отрисовка строк ---------- */

function segmentsToLines(segs) {
  const lines = [[]];
  for (const s of segs) {
    const parts = s.text.split('\n');
    parts.forEach((p, i) => {
      if (i > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ text: p, mark: s.mark });
    });
  }
  return lines;
}

function renderLines(cell, lines, startNo, opts = {}) {
  const box = cell.createDiv({ cls: ['scr-code'].concat(opts.cls ? [opts.cls] : []) });
  lines.forEach((line, i) => {
    const row = box.createDiv('scr-line');
    row.createSpan({ cls: 'scr-ln', text: startNo === null ? '' : String(startNo + i) });
    const tx = row.createSpan('scr-tx');
    if (Array.isArray(line)) {
      if (!line.length) tx.setText('​');
      for (const seg of line) tx.createSpan({ text: seg.text, cls: seg.mark ? 'scr-word' : '' });
    } else {
      tx.setText(line === '' ? '​' : line);
    }
  });
  if (!lines.length) box.createDiv({ cls: 'scr-line scr-line-void', text: opts.voidText || 'нет строк' });
  return box;
}

function chunkWordDiff(ch) {
  if (ch._wd !== undefined) return ch._wd;
  ch._wd = null;
  if (ch.left.length && ch.right.length) {
    const wd = wordDiff(ch.left.join('\n'), ch.right.join('\n'));
    if (wd) ch._wd = { left: segmentsToLines(wd.left), right: segmentsToLines(wd.right) };
  }
  return ch._wd;
}

const DECISION_LABEL = {
  left: 'Текущая',
  right: 'Копия',
  'both-lr': 'Обе: текущая + копия',
  'both-rl': 'Обе: копия + текущая',
  base: 'База',
  custom: 'Вручную',
};

function chunkState(ch) {
  if (ch.decision === null) return 'conflict';
  const autoDecision = ch.auto === 'same' ? 'left' : ch.auto;
  if (ch.auto && ch.decision === autoDecision) return 'auto';
  return 'resolved';
}

/* ---------- шапка ---------- */

function renderHead(view, wrap, s) {
  const { group, copy } = s;
  const core = view.core;
  const head = wrap.createDiv('scr-merge-head');

  const top = head.createDiv('scr-merge-top');
  button(top, { icon: 'arrow-left', title: 'К списку конфликтов', variant: 'ghost', onClick: () => view.setTab('list') });
  const title = top.createDiv('scr-merge-title');
  title.createDiv({ text: group.name, cls: 'scr-merge-name' });
  const sub = title.createDiv('scr-merge-path');
  sub.setText(group.path);
  if (group.renamedFrom) chip(sub, `переименован из ${group.renamedFrom.split('/').pop()}`, 'manual', 'file-input');
  if (group.source.kind !== 'vault') chip(sub, group.source.label, 'muted', 'folder-open');
  if (group.copies.length > 1) {
    const idx = group.copies.indexOf(copy) + 1;
    chip(sub, `копия ${idx} из ${group.copies.length}`, 'muted');
  }
  if (group.source.openable(group.path)) {
    button(top, {
      icon: 'file-text', title: 'Открыть файл', variant: 'ghost',
      onClick: () => core.app.workspace.openLinkText(group.path, '', 'split'),
    });
  }

  const sides = head.createDiv({ cls: ['scr-sides'].concat(s.mode === 'text' ? [] : ['scr-sides-2']) });
  const left = sides.createDiv('scr-side-card scr-side-left');
  left.createDiv({ text: 'Текущая версия', cls: 'scr-side-title' });
  left.createDiv({
    cls: 'scr-side-meta',
    text: s.origStat ? `${formatDate(s.origStat.mtime)} · ${formatSize(s.origStat.size)}` : 'файл отсутствует',
  });

  if (s.mode === 'text') {
    const base = sides.createDiv('scr-side-card scr-side-base');
    base.createDiv({ text: 'База (общий предок)', cls: 'scr-side-title' });
    const sel = base.createEl('select', { cls: 'dropdown scr-base-select' });
    const add = (value, text) => { const o = sel.createEl('option', { text, value }); if (value === s.baseChoice) o.selected = true; };
    add('auto', s.baseChoice === 'auto' && s.baseVersion ? `Авто: ${formatDate(s.baseVersion.time)}` : 'Авто');
    add('none', 'Без базы — двустороннее');
    for (const v of group.versions) add(v.path, formatDate(v.time));
    sel.addEventListener('change', async () => {
      if (s.hasManualDecisions()) {
        const ok = await confirm(core.app, {
          title: 'Сменить базу?',
          text: 'Блоки пересчитаются, решения, принятые вручную, сбросятся.',
          confirm: 'Сменить',
        });
        if (!ok) { sel.value = s.baseChoice; return; }
      }
      await s.applyBase(sel.value);
      view.rerender(true);
    });
    base.createDiv({
      cls: 'scr-side-meta',
      text: group.versions.length
        ? `${group.versions.length} ${plural(group.versions.length, 'версия', 'версии', 'версий')} в .stversions`
        : 'версий в .stversions нет',
    });
  }

  const right = sides.createDiv('scr-side-card scr-side-right');
  const rt = right.createDiv('scr-side-title');
  avatar(rt, core.deviceName(copy.device), copy.device);
  rt.createSpan({ text: `Копия · ${core.deviceName(copy.device)}` });
  right.createDiv({
    cls: 'scr-side-meta',
    text: `${formatDate(copy.time)} · ${formatSize(s.copyStat ? s.copyStat.size : copy.size)}`,
  });
}

/* ---------- текстовая сверка ---------- */

function renderText(view, wrap, s) {
  const st = s.stats();
  if (st.total === 0) {
    emptyState(wrap, {
      ico: 'check-circle-2',
      title: 'Содержимое совпадает',
      text: s.core.settings.ignoreTrailingWhitespace
        ? 'Отличия только в пробелах в конце строк или переводах строк.'
        : 'Отличаются только переводы строк — копию можно смело убрать.',
      action: { text: 'Убрать копию', variant: 'primary', icon: 'trash-2', onClick: () => view.runAction('identical') },
    });
    return;
  }

  if (s.baseWarning) {
    const w = wrap.createDiv('scr-banner scr-banner-warn');
    icon(w, 'alert-triangle');
    w.createSpan({
      text: s.baseWarning === 'left'
        ? 'База совпадает с текущей версией: автослияние фактически берёт все изменения копии. Проверьте блоки или выберите другую базу.'
        : 'База совпадает с копией: автослияние фактически оставляет текущую версию. Проверьте блоки или выберите другую базу.',
    });
  } else if (!s.baseText && s.group.versions.length === 0) {
    const w = wrap.createDiv('scr-banner');
    icon(w, 'info');
    w.createSpan({ text: 'Общий предок не найден — каждое отличие нужно решить вручную. Включите версионирование папки в Syncthing, чтобы появилось автослияние.' });
  }

  renderToolbar(view, wrap, s, st);

  const grid = wrap.createDiv('scr-grid');
  const hdr = grid.createDiv('scr-grid-head');
  hdr.createDiv({ cls: 'scr-col-title scr-col-left', text: 'Текущая версия' });
  hdr.createDiv({ cls: 'scr-col-title scr-col-mid', text: 'Результат' });
  hdr.createDiv({ cls: 'scr-col-title scr-col-right', text: `Копия · ${s.core.deviceName(s.copy.device)}` });

  const ctx = Math.max(0, Number(s.core.settings.contextLines) || 0);
  const chunks = s.model.chunks;
  let lnL = 1;
  let lnR = 1;
  let lnM = 1;

  chunks.forEach((ch, idx) => {
    if (ch.type === 'stable') {
      const n = ch.lines.length;
      const isFirst = idx === 0;
      const isLast = idx === chunks.length - 1;
      const headN = isFirst ? 0 : ctx;
      const tailN = isLast ? 0 : ctx;
      if (!s.expanded.has(idx) && n > headN + tailN + 2) {
        if (headN) renderStable(grid, ch.lines.slice(0, headN), lnL, lnR, lnM);
        const hidden = n - headN - tailN;
        const fold = grid.createDiv('scr-fold');
        icon(fold, 'unfold-vertical');
        fold.createSpan({ text: `${hidden} ${plural(hidden, 'строка', 'строки', 'строк')} без изменений` });
        fold.addEventListener('click', () => { s.expanded.add(idx); view.rerender(true); });
        if (tailN) renderStable(grid, ch.lines.slice(n - tailN), lnL + n - tailN, lnR + n - tailN, lnM + n - tailN);
      } else {
        renderStable(grid, ch.lines, lnL, lnR, lnM);
      }
      lnL += n; lnR += n; lnM += n;
      return;
    }
    renderChange(view, grid, s, ch, lnL, lnR, lnM);
    lnL += ch.left.length;
    lnR += ch.right.length;
    const res = resultLines(ch);
    if (res) lnM += res.length;
  });

  renderFooter(view, wrap, s, st);
}

function renderStable(grid, lines, lnL, lnR, lnM) {
  const row = grid.createDiv('scr-row scr-stable');
  renderLines(row.createDiv('scr-cell scr-left'), lines, lnL);
  renderLines(row.createDiv('scr-cell scr-mid'), lines, lnM);
  renderLines(row.createDiv('scr-cell scr-right'), lines, lnR);
}

function renderChange(view, grid, s, ch, lnL, lnR, lnM) {
  const state = chunkState(ch);
  const row = grid.createDiv({ cls: ['scr-row', 'scr-change', `is-${state}`] });
  row.dataset.id = ch.id;
  const wd = chunkWordDiff(ch);

  // Левая колонка
  const lc = row.createDiv('scr-cell scr-left');
  const lh = lc.createDiv('scr-cell-head');
  lh.createSpan({ cls: 'scr-cell-label', text: 'Текущая' });
  if (ch.label) chip(lh, ch.label, 'prop', 'list');
  button(lh, {
    icon: 'chevrons-right', title: 'Принять текущую версию блока', variant: 'take-left',
    cls: ch.decision === 'left' ? 'is-on' : null,
    onClick: () => { s.decide(ch, 'left'); view.rerender(true); },
  });
  renderLines(lc, wd ? wd.left : ch.left, lnL, { cls: 'scr-code-left', voidText: ch.label ? 'свойства нет' : 'строк нет' });

  // Середина — результат
  const mc = row.createDiv('scr-cell scr-mid');
  const mh = mc.createDiv('scr-cell-head');
  const pill = mh.createSpan({ cls: `scr-state scr-state-${state}` });
  if (state === 'conflict') pill.setText('Конфликт');
  else if (state === 'auto') pill.setText(ch.auto === 'same' ? 'Одинаково' : `Авто: ${ch.auto === 'left' ? 'текущая' : 'копия'}`);
  else pill.setText(DECISION_LABEL[ch.decision]);
  const tools = mh.createDiv('scr-mid-tools');
  button(tools, { text: 'Т+К', title: 'Оба: сначала текущая, потом копия', variant: 'mini', cls: ch.decision === 'both-lr' ? 'is-on' : null, onClick: () => { s.decide(ch, 'both-lr'); view.rerender(true); } });
  button(tools, { text: 'К+Т', title: 'Оба: сначала копия, потом текущая', variant: 'mini', cls: ch.decision === 'both-rl' ? 'is-on' : null, onClick: () => { s.decide(ch, 'both-rl'); view.rerender(true); } });
  if (ch.base) button(tools, { text: 'База', title: 'Вернуть как было в базе', variant: 'mini', cls: ch.decision === 'base' ? 'is-on' : null, onClick: () => { s.decide(ch, 'base'); view.rerender(true); } });
  button(tools, {
    icon: 'pencil', title: 'Править вручную', variant: 'mini', cls: ch.decision === 'custom' ? 'is-on' : null,
    onClick: () => {
      const current = resultLines(ch) || (ch.left.length ? ch.left : ch.right);
      ch.custom = current.slice();
      s.decide(ch, 'custom');
      s.editing = ch.id;
      view.rerender(true);
    },
  });
  if (state !== 'conflict' || ch.custom) {
    button(tools, { icon: 'rotate-ccw', title: 'Сбросить решение', variant: 'mini', onClick: () => { s.resetChunk(ch); view.rerender(true); } });
  }

  if (s.editing === ch.id) {
    const ta = mc.createEl('textarea', { cls: 'scr-editor' });
    ta.value = (ch.custom || []).join('\n');
    ta.rows = Math.min(24, Math.max(3, (ch.custom || []).length + 1));
    ta.addEventListener('input', () => { ch.custom = ta.value.split('\n'); });
    const act = mc.createDiv('scr-editor-actions');
    button(act, { text: 'Готово', variant: 'primary', onClick: () => { s.editing = null; view.rerender(true); } });
    setTimeout(() => ta.focus(), 0);
  } else {
    const res = resultLines(ch);
    if (res === null) {
      const ph = mc.createDiv('scr-placeholder');
      ph.setText(Platform.isMobile || view.isNarrow()
        ? 'Выберите: текущая, копия, обе или правка'
        : '← возьмите текущую, копию → или оба варианта');
    } else {
      const from = ch.decision === 'left' ? 'scr-from-left'
        : ch.decision === 'right' ? 'scr-from-right'
          : ch.decision === 'custom' ? 'scr-from-custom' : 'scr-from-mixed';
      renderLines(mc, res, lnM, { cls: from, voidText: 'блок удалён' });
    }
  }

  // Правая колонка
  const rc = row.createDiv('scr-cell scr-right');
  const rh = rc.createDiv('scr-cell-head');
  button(rh, {
    icon: 'chevrons-left', title: 'Принять версию копии', variant: 'take-right',
    cls: ch.decision === 'right' ? 'is-on' : null,
    onClick: () => { s.decide(ch, 'right'); view.rerender(true); },
  });
  rh.createSpan({ cls: 'scr-cell-label', text: 'Копия' });
  renderLines(rc, wd ? wd.right : ch.right, lnR, { cls: 'scr-code-right', voidText: ch.label ? 'свойства нет' : 'строк нет' });
}

function renderToolbar(view, wrap, s, st) {
  const bar = wrap.createDiv('scr-merge-toolbar');
  const prog = bar.createDiv('scr-progress');
  const done = st.total - st.unresolved;
  prog.createDiv({ cls: 'scr-progress-text', text: `Решено ${done} из ${st.total}` });
  const track = prog.createDiv('scr-progress-track');
  track.createDiv('scr-progress-fill').style.width = `${st.total ? (done / st.total) * 100 : 100}%`;
  const chips = bar.createDiv('scr-merge-chips');
  if (st.auto) chip(chips, `авто ${st.auto}`, 'auto', 'sparkles');
  if (st.manual) chip(chips, `вручную ${st.manual}`, 'manual', 'hand');
  if (st.unresolved) chip(chips, `конфликтов ${st.unresolved}`, 'conflict', 'alert-circle');

  const nav = bar.createDiv('scr-merge-nav');
  button(nav, { icon: 'chevron-up', title: 'Предыдущий конфликт', variant: 'ghost', disabled: !st.unresolved, onClick: () => view.jumpConflict(-1) });
  button(nav, { icon: 'chevron-down', title: 'Следующий конфликт', variant: 'ghost', disabled: !st.unresolved, onClick: () => view.jumpConflict(1) });
  button(nav, {
    icon: 'more-horizontal', title: 'Массовые действия', variant: 'ghost',
    onClick: (e) => {
      const m = new Menu();
      m.addItem((i) => i.setTitle('Все нерешённые — текущая').setIcon('chevrons-right').onClick(() => { s.decideAllUnresolved('left'); view.rerender(true); }));
      m.addItem((i) => i.setTitle('Все нерешённые — копия').setIcon('chevrons-left').onClick(() => { s.decideAllUnresolved('right'); view.rerender(true); }));
      m.addItem((i) => i.setTitle('Все нерешённые — обе (Т+К)').setIcon('copy').onClick(() => { s.decideAllUnresolved('both-lr'); view.rerender(true); }));
      m.addSeparator();
      m.addItem((i) => i.setTitle('Развернуть все строки').setIcon('unfold-vertical').onClick(() => {
        s.model.chunks.forEach((c, idx) => s.expanded.add(idx));
        view.rerender(true);
      }));
      m.addItem((i) => i.setTitle('Сбросить все решения').setIcon('rotate-ccw').onClick(() => {
        s.changes().forEach((c) => s.resetChunk(c));
        view.rerender(true);
      }));
      m.showAtMouseEvent(e);
    },
  });
}

function renderFooter(view, wrap, s, st) {
  const f = wrap.createDiv('scr-merge-footer');
  const left = f.createDiv('scr-footer-left');
  button(left, { text: 'Оставить текущую', title: 'Оставить текущую версию целиком', icon: 'file-check', variant: 'ghost', onClick: () => view.runAction('keep') });
  button(left, { text: 'Взять копию', title: 'Взять копию целиком', icon: 'file-input', variant: 'ghost', onClick: () => view.runAction('take') });
  button(left, { text: 'Оставить обе', title: 'Сохранить копию отдельным файлом', icon: 'files', variant: 'ghost', onClick: () => view.runAction('both') });
  const right = f.createDiv('scr-footer-right');
  if (st.unresolved) right.createSpan({ cls: 'scr-footer-hint', text: `Осталось ${st.unresolved} ${plural(st.unresolved, 'конфликт', 'конфликта', 'конфликтов')}` });
  button(right, {
    text: 'Сохранить результат', icon: 'check', variant: 'primary', disabled: st.unresolved > 0,
    onClick: () => view.saveMerge(),
  });
}

/* ---------- бинарные файлы и картинки ---------- */

async function previewInto(el, s, path) {
  const { group } = s;
  if (group.kind !== 'image') {
    icon(el.createDiv('scr-bin-ico'), 'file');
    return;
  }
  let url = group.source.resourceUrl(path);
  if (!url) {
    try {
      const data = await group.source.readBinary(path);
      url = s.trackBlob(URL.createObjectURL(new Blob([data], { type: mimeOf(path) })));
    } catch (e) { url = null; }
  }
  if (url) el.createEl('img', { attr: { src: url, alt: '' } });
}

function renderBinary(view, wrap, s) {
  const { group, copy } = s;
  const grid = wrap.createDiv('scr-bin');
  const card = (title, path, meta, ico, action, variant) => {
    const c = grid.createDiv(`scr-bin-card scr-bin-${variant}`);
    c.createDiv({ cls: 'scr-side-title', text: title });
    const pv = c.createDiv('scr-bin-preview');
    previewInto(pv, s, path);
    c.createDiv({ cls: 'scr-side-meta', text: meta });
    button(c, { text: action.text, icon: ico, variant: 'primary', onClick: action.onClick });
  };
  card('Текущая версия', group.path, s.origStat ? `${formatDate(s.origStat.mtime)} · ${formatSize(s.origStat.size)}` : '',
    'file-check', { text: 'Оставить текущую', onClick: () => view.runAction('keep') }, 'left');
  card(`Копия · ${view.core.deviceName(copy.device)}`, copy.path, `${formatDate(copy.time)} · ${formatSize(s.copyStat ? s.copyStat.size : copy.size)}`,
    'file-input', { text: 'Взять копию', onClick: () => view.runAction('take') }, 'right');
  const f = wrap.createDiv('scr-merge-footer');
  f.createDiv({ cls: 'scr-footer-hint', text: group.kind === 'image' ? 'Картинки сравниваются целиком.' : 'Двоичный файл — построчная сверка невозможна.' });
  button(f.createDiv('scr-footer-right'), { text: 'Оставить обе', icon: 'files', variant: 'ghost', onClick: () => view.runAction('both') });
}

function renderMissing(view, wrap, s) {
  const { copy } = s;
  const b = wrap.createDiv('scr-banner scr-banner-warn');
  icon(b, 'file-x');
  b.createSpan({ text: 'Исходного файла нет: на одном устройстве его удалили или переименовали, а на другом изменили.' });
  const card = wrap.createDiv('scr-bin-card scr-bin-right scr-missing');
  card.createDiv({ cls: 'scr-side-title', text: `Копия · ${view.core.deviceName(copy.device)} · ${relativeAge(copy.time)}` });
  if (s.rightText !== undefined) {
    const pre = card.createEl('pre', { cls: 'scr-missing-pre' });
    pre.setText(s.rightText.length > 4000 ? `${s.rightText.slice(0, 4000)}\n…` : s.rightText);
  } else {
    previewInto(card.createDiv('scr-bin-preview'), s, copy.path);
  }
  const f = wrap.createDiv('scr-merge-footer');
  const r = f.createDiv('scr-footer-right');
  button(r, { text: 'Удалить копию', icon: 'trash-2', variant: 'ghost', onClick: () => view.runAction('keep') });
  button(r, { text: 'Восстановить из копии', icon: 'undo-2', variant: 'primary', onClick: () => view.runAction('take') });
}

/* ---------- вход ---------- */

function renderMergeTab(view, el) {
  const s = view.session;
  if (!s) {
    emptyState(el, {
      ico: 'git-compare',
      title: 'Ничего не открыто',
      text: 'Выберите конфликт на вкладке «Конфликты» и нажмите «Сверить».',
      action: { text: 'К списку', icon: 'list', onClick: () => view.setTab('list') },
    });
    return;
  }
  if (s.loading) {
    emptyState(el, { ico: 'loader', title: 'Загружаю версии…' });
    return;
  }
  const wrap = el.createDiv('scr-merge');
  renderHead(view, wrap, s);
  if (s.error) {
    const b = wrap.createDiv('scr-banner scr-banner-error');
    icon(b, 'x-circle');
    b.createSpan({ text: `Не удалось прочитать файлы: ${s.error}` });
    return;
  }
  if (s.mode === 'binary') renderBinary(view, wrap, s);
  else if (s.mode === 'missing') renderMissing(view, wrap, s);
  else renderText(view, wrap, s);
}

module.exports = { renderMergeTab };

  },
  "src/ui/stats-tab.js": function (module, exports, require) {
'use strict';
/**
 * Вкладка «Статистика»: сколько конфликтов появляется и решается, за сколько, где и откуда.
 */

const { ACTION_LABELS } = require('../journal');
const { formatDuration } = require('../stats');
const { button, icon, statCard, emptyState, confirm } = require('./dom');

const PERIODS = [[7, '7 дней'], [30, '30 дней'], [90, '90 дней'], [null, 'Всё время']];
const KINDS = { text: 'Текст', image: 'Картинки', binary: 'Другие файлы' };
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function bars(parent, title, rows, opts = {}) {
  const box = parent.createDiv('scr-panel');
  const head = box.createDiv('scr-panel-title');
  if (opts.ico) icon(head, opts.ico);
  head.createSpan({ text: title });
  const max = Math.max(1, ...rows.map((r) => r[1]));
  for (const [key, n] of rows.slice(0, opts.limit || 8)) {
    const row = box.createDiv('scr-bar');
    const label = row.createDiv({ cls: 'scr-bar-label', text: opts.label ? opts.label(key) : String(key) });
    label.setAttr('title', opts.label ? opts.label(key) : String(key));
    if (opts.onClick) { label.addClass('is-link'); label.addEventListener('click', () => opts.onClick(key)); }
    const track = row.createDiv('scr-bar-track');
    track.createDiv(`scr-bar-fill${opts.variant ? ` scr-bar-${opts.variant}` : ''}`).style.width = `${(n / max) * 100}%`;
    row.createDiv({ cls: 'scr-bar-value', text: String(n) });
  }
  if (!rows.length) box.createDiv({ cls: 'scr-muted', text: 'Пока нет данных' });
  return box;
}

function dailyChart(parent, series) {
  const box = parent.createDiv('scr-panel scr-chart-panel');
  const head = box.createDiv('scr-chart-head');
  const title = head.createDiv('scr-panel-title');
  icon(title, 'bar-chart-3');
  title.createSpan({ text: 'По дням' });
  const legend = head.createDiv('scr-legend');
  legend.createSpan({ cls: 'scr-legend-item scr-legend-detected', text: 'появилось' });
  legend.createSpan({ cls: 'scr-legend-item scr-legend-resolved', text: 'решено' });

  const max = Math.max(1, ...series.map((d) => Math.max(d.detected, d.resolved)));
  const chart = box.createDiv('scr-chart');
  chart.style.setProperty('--scr-cols', String(series.length));
  const labelEvery = series.length <= 10 ? 1 : series.length <= 31 ? 5 : series.length <= 92 ? 14 : 30;
  series.forEach((d, i) => {
    const col = chart.createDiv('scr-chart-col');
    col.setAttr('title', `${d.date.getDate()} ${MONTHS_SHORT[d.date.getMonth()]}: появилось ${d.detected}, решено ${d.resolved}`);
    const stack = col.createDiv('scr-chart-bars');
    stack.createDiv('scr-chart-bar scr-chart-detected').style.height = `${(d.detected / max) * 100}%`;
    stack.createDiv('scr-chart-bar scr-chart-resolved').style.height = `${(d.resolved / max) * 100}%`;
    const showLabel = (series.length - 1 - i) % labelEvery === 0;
    col.createDiv({ cls: 'scr-chart-label', text: showLabel ? `${d.date.getDate()} ${MONTHS_SHORT[d.date.getMonth()]}` : '' });
  });
  chart.createDiv({ cls: 'scr-chart-max', text: String(max) });
}

function renderStatsTab(view, el) {
  const core = view.core;
  const state = view.statsState;
  const sum = core.stats.summary(state.period);
  const page = el.createDiv('scr-statspage');

  const tb = page.createDiv('scr-toolbar');
  const seg = tb.createDiv('scr-seg');
  for (const [days, label] of PERIODS) {
    const b = seg.createEl('button', { text: label, cls: state.period === days ? 'is-active' : '' });
    b.addEventListener('click', () => { state.period = days; view.rerender(false); });
  }
  const right = tb.createDiv('scr-toolbar-right');
  button(right, { text: 'Отчёт в заметку', icon: 'file-plus-2', variant: 'soft', onClick: () => core.writeStatsNote() });
  button(right, {
    icon: 'trash-2', title: 'Сбросить статистику и журнал', variant: 'ghost',
    onClick: async () => {
      const ok = await confirm(core.app, {
        title: 'Сбросить статистику?',
        text: 'Удалятся история обнаруженных конфликтов и журнал решений. Файлы не затрагиваются.',
        confirm: 'Сбросить', danger: true,
      });
      if (!ok) return;
      core.stats.clear();
      await core.saveData_();
      view.rerender(false);
    },
  });

  const stats = page.createDiv('scr-stats scr-stats-5');
  statCard(stats, { label: 'Появилось', value: sum.detected, ico: 'alert-circle', variant: sum.detected ? 'warn' : null, hint: 'конфликтных копий' });
  statCard(stats, { label: 'Решено', value: sum.resolved, ico: 'check-check', variant: 'ok' });
  statCard(stats, { label: 'Открыто сейчас', value: sum.open, ico: 'git-merge', variant: sum.open ? 'warn' : 'ok' });
  statCard(stats, {
    label: 'До решения', value: formatDuration(sum.medianMs), ico: 'timer',
    hint: sum.avgMs !== null ? `медиана · в среднем ${formatDuration(sum.avgMs)}` : 'медиана',
  });
  statCard(stats, {
    label: 'Автослияние', value: sum.autoRate === null ? '—' : `${Math.round(sum.autoRate * 100)}%`, ico: 'sparkles',
    hint: `блоков: авто ${sum.autoBlocks}, вручную ${sum.manualBlocks}`,
  });

  if (!sum.detected && !sum.resolved) {
    emptyState(page, {
      ico: 'bar-chart-3',
      title: 'Данных пока нет',
      text: 'Статистика копится с момента установки: каждый найденный и каждый решённый конфликт попадает сюда.',
    });
    return;
  }

  dailyChart(page, sum.series);

  const panels = page.createDiv('scr-panels');
  bars(panels, 'Откуда приходят (устройства)', sum.byDevice, { ico: 'smartphone' });
  bars(panels, 'Где возникают (папки)', sum.byFolder, { ico: 'folder' });
  bars(panels, 'Самые конфликтные файлы', sum.topFiles, {
    ico: 'flame', variant: 'warn', limit: 10,
    label: (p) => p,
    onClick: (p) => core.app.workspace.openLinkText(p, '', 'tab'),
  });
  bars(panels, 'Как решались', sum.byAction, { ico: 'git-compare', label: (k) => ACTION_LABELS[k] || k });
  bars(panels, 'Типы файлов', sum.byKind, { ico: 'files', label: (k) => KINDS[k] || k });
  const wd = WEEKDAYS.map((_, i) => [i, (sum.byWeekday.find((x) => x[0] === i) || [i, 0])[1]]);
  bars(panels, 'По дням недели', wd, { ico: 'calendar', label: (i) => WEEKDAYS[i], limit: 7 });
}

module.exports = { renderStatsTab };

  },
  "src/ui/view.js": function (module, exports, require) {
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

  },
  "src/util.js": function (module, exports, require) {
'use strict';

const { TEXT_EXT, IMAGE_EXT } = require('./constants');

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

const pad = (n) => String(n).padStart(2, '0');

/** «6 мая 2026, 12:30» */
function formatDate(value) {
  if (value === null || value === undefined) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** «2026-05-06 12-30» — для имён файлов */
function fileStamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}`;
}

function relativeAge(value) {
  const diff = Date.now() - new Date(value).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} дн назад`;
  return formatDate(value);
}

function parseStamp(d8, t6) {
  return new Date(
    Number(d8.slice(0, 4)), Number(d8.slice(4, 6)) - 1, Number(d8.slice(6, 8)),
    Number(t6.slice(0, 2)), Number(t6.slice(2, 4)), Number(t6.slice(4, 6)),
  );
}

function formatSize(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function basename(p) { const i = p.lastIndexOf('/'); return i < 0 ? p : p.slice(i + 1); }
function dirname(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function joinPath(...parts) {
  return parts.filter((x) => x !== undefined && x !== null && x !== '').join('/').replace(/\/+/g, '/').replace(/^\.\//, '');
}
function extOf(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i <= 0 ? '' : b.slice(i + 1).toLowerCase();
}
function splitExt(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  const dir = dirname(p);
  if (i <= 0) return { dir, stem: b, ext: '' };
  return { dir, stem: b.slice(0, i), ext: b.slice(i) };
}

function fileKind(p) {
  const e = extOf(p);
  if (IMAGE_EXT.includes(e) && e !== 'svg') return 'image';
  if (TEXT_EXT.includes(e)) return 'text';
  if (!e) return 'text';
  return 'binary';
}

function mimeOf(p) {
  const e = extOf(p);
  const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic', svg: 'image/svg+xml' };
  return map[e] || 'application/octet-stream';
}

function sameBuffers(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

function looksBinary(buf) {
  const bytes = new Uint8Array(buf, 0, Math.min(buf.byteLength, 8000));
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0) return true;
  return false;
}

function isAbsolutePath(p) {
  return /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(p || '');
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

module.exports = {
  formatDate, fileStamp, relativeAge, parseStamp, formatSize, basename, dirname, joinPath,
  extOf, splitExt, fileKind, mimeOf, sameBuffers, looksBinary, isAbsolutePath, plural, pad,
};

  },
};

const cache = new Map();
function resolve(from, spec) {
  const parts = from.split('/').slice(0, -1);
  for (const p of spec.split('/')) {
    if (p === '.' || p === '') continue;
    if (p === '..') parts.pop(); else parts.push(p);
  }
  let file = parts.join('/');
  if (!file.endsWith('.js')) file += '.js';
  return file;
}
function load(from, spec) {
  if (!spec.startsWith('.')) return require(spec);
  const file = resolve(from, spec);
  if (cache.has(file)) return cache.get(file).exports;
  const fn = MODULES[file];
  if (!fn) throw new Error('Модуль не найден: ' + file);
  const module = { exports: {} };
  cache.set(file, module);
  fn(module, module.exports, (s) => load(file, s));
  return module.exports;
}

module.exports = class SyncthingConflictResolver extends obsidian.Plugin {
  async onload() {
    try {
      globalThis.__SCR_README = README;
      const { Core } = load('main.js', './src/plugin.js');
      this.core = new Core(this);
      await this.core.onload();
    } catch (e) {
      console.error('[Syncthing Conflict Resolver] не удалось загрузить', e);
      new obsidian.Notice('Syncthing Conflict Resolver: ' + e.message);
    }
  }
  onunload() { if (this.core) this.core.onunload(); }
};
