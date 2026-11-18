# Технический долг

Источник: ревью архитектуры 2026-11-18. Порядок — по важности. Статус: `[ ]` открыт, `[x]` закрыт.

## Высокий приоритет

- [x] **Нет CI.** Закрыто 2026-11-18: `.github/workflows/ci.yml` (app: lint+typecheck+typecheck:app+jest; server: typecheck+тесты с Postgres 16). Не проверено на GitHub до первого push. Ниже — исходная запись: Нет `.github/workflows`. Гонять `lint`, `typecheck`, `jest` и серверные тесты (`server: npm test`) на каждый push/PR. ~1 час.
- [x] **`typecheck:app` сломан.** Закрыто 2026-11-18: `delaysContentTouches` вынесен в типизированную константу; `tsconfig.app.json` больше не наследует expo base (TS 5.3 не знает `module: preserve`) — вернуть `extends`, когда TS ≥ 5.5. Исходно: 2 ошибки: `delaysContentTouches` не существует в `ScrollViewProps`. Код RN сейчас никто не проверяет; `typecheck` смотрит только то, что видит `tsconfig.jest.json`.
- [ ] **`app/practice.tsx` — god-экран** (792 строки, 42 хука). Создаёт репозитории, outbox, progress-клиент, audio session прямо в компоненте (строки ~113–330). Вынести composition root в провайдер/фабрику.
- [ ] **`usePracticeLoop.ts`** (885 строк, 79 хуков) не покрыт тестами: jest только ts-jest/node, без RN. Самый рискованный код — цикл практики и синхронизация — вне тестов. Выделить чистую логику в `.ts` и тестировать через `PracticeLoopDeps`.

## Средний приоритет

- [ ] **Дубль грейдера** клиент/сервер: `src/services/grading/grade.ts` и `server/src/game/grade.ts`. Сейчас страхует `tests/unit/graderParity.test.ts`. Свести к одному источнику (общий workspace-пакет или только сервер).
- [ ] **Две схемы БД.** `server/src/db/ddl.ts` (идемпотентный `create if not exists` при старте) и `schema.ts` (Drizzle) описывают одно и то же; версионных миграций и отката нет. Перейти на drizzle-migrations, убрать `ddl.ts`.
- [ ] **Нет границ слоёв.** `app/` ↔ `src/` без правил импорта; `src/lib` смешивает домен, UI-хелперы и инфраструктуру; `tests/` и `src/` импортируют `server/src` по относительным путям. Добавить lint-правила на импорты, вынести общее в пакет.

## Низкий приоритет

- [ ] **Тяжёлые файлы в git:** `landing/promo.mp4` (3,5 МБ), PNG в `assets/video/remotion/public/twinkle/` (~700 КБ каждый). Вынести в хранилище/LFS.
- [x] **Двусмысленные имена на сервере:** закрыто 2026-11-18: CLI теперь `comments/main.ts` и `publish/main.ts`. Было: `comments.ts` рядом с `comments/`, `publish.ts` рядом с `publish/`.
- [ ] **Маркетинг и продукт в одном репо** (Remotion, соцсети, `docs/` со сценариями). Рассмотреть разделение.
- [x] **Артефакты в рабочей папке:** проверено 2026-11-18, уже в `.gitignore` и не отслеживаются. Было: `coverage/`, `dist/`, `build/` — проверить, что в `.gitignore`.
