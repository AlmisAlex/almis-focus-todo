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

## Data flow

Форма → проверка заголовка → новая задача → сохранение → доступный список.
Старт → безопасное чтение storage → проверка схемы → восстановление задач.
Текст отображается как текст, HTML из задач не исполняется.

## Run and verify

Node22.12+; `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`,
`npm run build`. 22 unit-теста покрывают модель, хранение, конкурентные
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
