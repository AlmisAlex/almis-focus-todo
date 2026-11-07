# FOCUS — карта проекта

## Purpose and boundaries

To-Do frontend: задачи живут в браузере, четыре функции тестового плюс
доступные фильтры/поиск и премиальный адаптивный интерфейс. Это отдельный
проект, а не часть SaleBot, Radar или VPN.
Сайт: https://todo.almistech.ru. Код: https://github.com/AlmisAlex/almis-focus-todo.

## Module responsibilities

Реализованные границы: `src/domain/` — модель и валидация; `src/storage/` —
версионированный localStorage; `src/hooks/` — состояние UI; `src/components/`
— интерфейс; `public/` — собственная графика и шрифты; `tests/` — проверки.
`src/storage/taskRepository.ts` сериализует операции, хранит несохранённые
намерения и повторяет их поверх свежего канонического списка.
`src/hooks/useTasks.ts` подключает React, Web Locks и browser events.
`src/domain/taskQueries.ts` — календарные разделы, поиск и сортировка.
`src/storage/taskTransfer.ts` — валидация импорта и локальный экспорт.
`TaskComposer` создаёт задачи; `TaskEditor` управляет черновиком/modal/focus;
`TaskBackup` отвечает за файлы копий; `TaskItem` отображает задачу и действия.
App объединяет пользовательские сценарии.

## Data flow

Форма → проверка заголовка → новая задача → сохранение → доступный список.
Старт → безопасное чтение storage → проверка схемы → восстановление задач.
Текст отображается как текст, HTML из задач не исполняется.

## Run and verify

Node22.12+; `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`,
`npm run build`. 79 unit-тестов покрывают модель, хранение, конкурентные
операции, отказ записи и восстановление. Browser QA дополнительно проверяет
полный пользовательский цикл, реальные две вкладки и ширины360–1440px.
Browser QA — существующий shared browser, только свой tab/operation_id.
Синтетические тестовые задачи; реальные клиентские данные не использовать.

## Deployment

Статические файлы `dist/` опубликованы отдельным Nginx vhost
`todo.almistech.ru`, с HTTPS, ограничивающей CSP и локальными ресурсами.
Бэкенда и процессов приложения на сервере нет. Все задачи остаются
в localStorage браузера; это локальный список, без синхронизации устройств.
Серверный deployment/checkpoint и приватные evidence хранятся вне git.

## Change rules

Новый persistence-контракт требует валидации и тестов миграции. Не добавлять
сервер/аккаунты/платежи. Не публиковать `.private/`/`.task` и переписку.
DNS/deployment — точная новая запись/папка, с checkpoint и live-доказательством.

Текущая схема v3 читает v1/v2 и сохраняет полную копию перед первой записью.
Удаление в другой вкладке выигрывает у устаревшего editor draft; остальные
несохранённые действия replay применяются к свежему каноническому списку.
Browser evidence прежнего релиза не считается проверкой изменённого UI.

## Calendar planning

`src/domain/calendar.ts` — чистая календарная арифметика без DST-сдвигов,
месячная сетка и форматирование. `TaskCalendar` — выбор дня, нагрузка,
roving keyboard focus; `WeekOverview` — обзор ближайших семи дней.
`DateShortcuts` — единые быстрые даты в composer/editor; `BulkSchedule` —
назначение срока выбранным задачам. Action `set-dates` меняет только dueDate;
expectedDate у отмены сохраняет более поздние изменения. Новых зависимостей
и сетевой отправки нет. Поиск согласован со счётчиками.

## Workspace v3

`src/domain/projects.ts` — ограниченный каталог проектов и цвета;
`workspace.ts` — атомарные операции каталога и задач, нормализация удалённых
связей во «Входящие», replay всего workspace; `workspaceRoute.ts` — безопасные
локальные hash-ссылки на разделы/проекты; `ids.ts` — случайные UI IDs.
`TaskRepository` теперь хранит и повторяет WorkspaceAction и пишет один root v3.
`TaskStorage` читает v1/v2/v3, сохраняет full before-v3 и проверяет связи/шаги;
`TaskTransfer` переносит каталог вместе с задачами, совпавшие ID не затираются.

`WorkspaceSidebar` — навигация/каталог, `DayOverview` — реальный план и следующие
незавершённые шаги, `ProjectDialog` — управление проектом без удаления задач.
`ChecklistEditor` — draft шагов. `TaskEditor` — просторный desktop/mobile dialog;
общий `useDialog` управляет открытием/фокусом/Tab trap. TaskItem открывает детали
по названию и отдельно меняет готовность, дневной фокус и шаги.

Удаление/массовые действия используют тот же `queryWorkspaceTasks`, что и список:
они не пересекают проект/календарный день/поисковый scope. Редактор передаёт шаги
только при их изменении, чтобы не затереть готовность из другой вкладки. Завершение
родителя завершает шаги; появление незавершённого шага открывает родителя.
Фокус привязан к календарному дню и не меняет реальный срок. Все данные локальны.

## Quality and attachments

`commandSearch.ts`/`CommandPalette` — глобальные поиск и переходы, Ctrl/Cmd K.
Editor отправляет изменённые поля; `mergeSteps` сравнивает draft с baseline,
сохраняет новые/отмеченные шаги другой вкладки и её удаления. Bulk set-projects
с expectedProjectId позволяет отменить перенос без замены более поздней правки.

`attachments.ts` — безопасные метаданные/имена, лимиты и тип просмотра;
`attachmentStorage.ts` — IndexedDB readwrite transaction для лимитов и записи;
`useAttachments` — async состояние, broadcast и focus refresh.
`TaskAttachments` сохраняет файлы сразу, отдельно от editor draft. `FileLibrary`
оставляет доступными вложения удалённых задач; явное удаление файла не имеет undo.
`FilePreview` — canvas raster, инертный текст, native PDF или binary download;
object URLs/bitmaps освобождаются. Нет внешних viewers, iframe и сетевых API.

`workspaceBackup.ts` — полный JSON v4 с base64-вложениями, включая orphan files;
чтение старых v1/v2/v3. Task root остаётся v3. LocalStorage/IndexedDB не образуют
одной транзакции: при частичном отказе импорт сохраняет preview, повтор пропускает
добавленные ID. `styles.css` содержит общие controls/forms, `workspace.css` —
workspace и календарь, `files.css` — вложения, `command.css` — общий поиск.
Старый слой `quality.css` удалён при смене дизайна.

## Modal workflow

`TaskComposer` — окно создания, `TaskEditor` — редактирование; общие `TaskFields`
и `taskDraft.ts` управляют полями и последним набранным шагом. Enter в шаге не
отправляет форму, Ctrl/Cmd Enter сохраняет; IME composition защищён. Title/notes
многострочные. Header/body/footer имеют отдельные области прокрутки. Native dialog,
CSS scroll lock и общий focus trap сохраняют контекст без перехода к inline форме.

Создание возвращает ID из useTasks.add, затем записывает pending files. При
отказе файла ID остаётся в окне, повтор не создаёт дубль. Если задача удалена
другой вкладкой, retry отключён; пользователь может явно вернуться к черновику
и создать новый ID. Вложения существующей задачи сохраняются сразу.
Ошибки создания находятся внутри окна. Экспорт подтверждается рядом с кнопкой,
сохраняя undo удаления; несвязанные project notices сбрасывают старую отмену.
Storage schemas, зависимости и сетевые границы сохранены.
