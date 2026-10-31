# Play Console: готовые ответы

Составлено 2026-10-31 по коду (`server/src/db/schema.ts`, `src/services/*`, Sentry-конфиг) и по сборке
`1700935a` (preview, коммит `f141fff`). Если код поменялся, сверьте ещё раз с «Что реально собирается».

## Что реально собирается (основа для Data Safety)

| Данные | Когда | Куда | Таблица / сервис |
|---|---|---|---|
| Случайный id установки (`dev_…`) | всегда | наш сервер, Sentry | `attempt_log`, `app_events`, `device_links` |
| Итог каждого ответа: уровень, длина, верно/нет, сколько нот совпало/неверно/пропущено | всегда | наш сервер | `attempt_log` |
| События: `app_open`, `onboarding_done`, `session_start`, `session_end` (длина, число попыток) | всегда | наш сервер | `app_events` |
| Краши: ошибка, версия, модель, версия Android | при сбое | Sentry | — |
| Email | только при входе | наш сервер, почтовый сервис, Sentry | `users`, `login_codes` |
| Прогресс аккаунта: мелодия, поставленные ноты и их оценка, сложность | только при входе | наш сервер | `progress_attempts`, `progress_difficulty` |
| Хеш IP | при запросе кода | наш сервер | `login_codes.source_hash` (только лимиты, не геолокация) |

Не собирается: аудио (микрофона нет в манифесте), геолокация, контакты, фото, рекламный id, платежи.

## Data Safety

- **Собирает или передаёт данные пользователей?** Да.
- **Все данные шифруются при передаче?** Да (HTTPS).
- **Можно запросить удаление?** Да. В приложении: Settings → Account → Delete account. В вебе:
  `https://earwarrior.app/delete-account/`.
- **Передача третьим лицам (sharing):** нет. Sentry и почтовый сервис обрабатывают данные от нашего имени,
  а такое Google за передачу не считает.

Типы данных (у всех: *collected = да, shared = нет, ephemeral = нет*):

| Раздел формы | Тип | Обязательно? | Цели |
|---|---|---|---|
| Personal info | Email address | Optional | Account management, Developer communications, Analytics |
| App activity | App interactions | Required | Analytics, App functionality |
| App activity | Other user-generated content | Optional (только с аккаунтом) | App functionality |
| App info and performance | Crash logs | Required | Analytics |
| App info and performance | Diagnostics | Required | Analytics |
| Device or other IDs | Device or other IDs | Required | Analytics, App functionality |

«Other user-generated content» — это ноты, которые человек ставит в ответе и которые хранятся с аккаунтом.
Если это кажется натяжкой, достаточно «App interactions», но так полнее.

## Остальные анкеты

- **App access:** «All functionality is available without special access» — вход необязателен.
  Тестовый аккаунт не нужен. Если рецензент всё-таки попросит, включите `AUTH_TEST_EMAIL` + `AUTH_TEST_CODE`
  на Vercel (`specs/005-user-auth/quickstart.md` §6).
- **Ads:** нет рекламы.
- **Advertising ID:** не используется (`AD_ID` в манифесте нет).
- **Content rating (IARC):** категория «Reference, News, or Educational». На все вопросы про насилие,
  секс, лексику, вещества, азартные игры — нет. Пользователи не общаются друг с другом, местоположением
  не делятся, цифровых покупок нет, неограниченного доступа в интернет нет. Ожидаемо: Everyone / PEGI 3 / 0+.
- **Target audience:** только 18+. Так не включается политика Families; бета-тестеры взрослые.
  «Может ли приложение непреднамеренно привлекать детей?» — нет.
- **Permissions declaration:** нечего декларировать. Чувствительных разрешений нет: SMS, звонки, геолокация,
  микрофон, файлы. С 2026-10-31 из манифеста убраны и `SYSTEM_ALERT_WINDOW` с
  `READ/WRITE_EXTERNAL_STORAGE`: они попадут в следующую сборку.
- **News / Health / Financial features / Government:** нет.
- **Категория:** Music & Audio. Теги: ear training, guitar, music education.
- **Контакты:** email `golovsha@gmail.com` (тот же, что в «Write to us»), сайт `https://earwarrior.app`,
  privacy `https://earwarrior.app/privacy/`.

## Листинг

Графика: иконка `assets/store/icon-512.png`, feature graphic `assets/store/feature-graphic.png`,
скриншоты `assets/store/screenshots/01–04` (1080×2160, это 2:1 — предел Play).

**App name** (≤ 30): `Ear Warrior: Guitar by Ear` (26)

**Short description** (≤ 80):

> Hear a short melody, find it on the fretboard. Ear training for guitarists.

**Full description** (≤ 4000):

> Can you play a tune you just heard — without looking up the tab?
>
> Ear Warrior trains exactly that. A short melody plays. You find it on an on-screen guitar fretboard,
> tapping the notes where you think they live on the neck. Every tap sounds, so your ear can check your
> hand. Then you see which notes landed and which did not, and try again.
>
> HOW IT WORKS
> • Listen: a few notes, played once.
> • Find them: tap the notes on the fretboard, in order. Any string is fine — it is the pitch that counts.
> • Hear the verdict: matched, wrong and missed notes, note by note.
>
> BUILT FOR GUITARISTS
> • A real 12-fret neck in standard tuning, open strings to the 12th fret.
> • Real tunes, not random beeps: folk songs and classical themes you half-know already.
> • 9 levels, from 3-note phrases to 16-note lines.
> • Adaptive mode moves you up after three right answers in a row and down after two misses — or pick a
>   level and stay there.
> • Progress view: accuracy, sessions and the kinds of melodies you miss most.
>
> NO MICROPHONE, NO ACCOUNT NEEDED
> Ear Warrior never uses your microphone. Practice works offline and without signing in; an optional
> email sign-in keeps your progress across phones.
>
> Short rounds, a few minutes a day. The goal: the next time someone plays a line at a jam, you can find it.

Прежде чем вставлять: проверьте, что обещания совпадают с бетой (9 уровней, офлайн, без микрофона). Слов
«iOS» и «первые 100 — lifetime» в тексте нарочно нет.
