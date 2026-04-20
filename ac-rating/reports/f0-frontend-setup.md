# Фаза F0: Frontend onboarding + skeleton — отчёт

**Ветка:** `ac-rating/f0-frontend-setup` (от `main`)
**Дата:** 2026-04-20
**Агент:** Федя (frontend)

**Коммиты** (`git log --oneline main..HEAD`, без докоммита этого отчёта):

- `080c322` feat(ac-rating): scoped design tokens .rating-scope
- `64f86cb` feat(ac-rating): RatingLayout with next/font/google
- `508929a` feat(ac-rating): skeleton routes + flat RatingHeader
- `37c0f26` feat(ac-rating): TS types + public API client for rating

## Что сделано — 4 подзадачи

### 1. Scoped дизайн-токены `.rating-scope`

`frontend/app/ratings/_styles/tokens.css` — новый файл, 55 строк.

- Префикс `--rt-*` (rating), изоляция через селектор `.rating-scope` + `.dark .rating-scope`.
- Все цвета в формате `H S% L%` / `H S% L% / alpha` (hsl без внешней функции) — удобно подставлять через `hsl(var(--rt-*))`.
- Перенесено из `ac-rating/design/index.html:12-72` (light) и `index.html:30-44` + dark-варианты из `wf-primitives.jsx:18-24`.
- Три шрифтовые переменные (`--rt-font-sans/-serif/-mono`) делают фоллбэк цепочкой: сначала `next/font`-переменная из layout, потом именованный шрифт, потом системный.
- **`frontend/app/globals.css` не тронут.**

### 2. Layout рейтинга + шрифты

`frontend/app/ratings/layout.tsx` — server component:

- `next/font/google` грузит Inter (400/500/600/700, latin+cyrillic), Source Serif 4 (400/600/700, latin+cyrillic), JetBrains Mono (400/500, latin). Все — `display: swap`.
- Каждый шрифт биндится в CSS-variable (`--rt-font-sans-loaded` и т.д.), которая разворачивается внутри `--rt-font-*` из tokens.css.
- Wrapper имеет классы `rating-scope` + все три `font.variable`, inline-стили задают `background: hsl(var(--rt-paper))`, `color: hsl(var(--rt-ink))`, `fontFamily: var(--rt-font-sans)`.
- `metadata.title` устроен с `default`+`template`, чтобы дочерние страницы могли переопределять.

### 3. 5 skeleton routes + плоский `RatingHeader`

`frontend/app/ratings/_components/RatingHeader.tsx`:

- 8 nav-items по `wf-nav.jsx:4-12` + 1 добавленный «Стандарт монтажа» из плана (Ф6A решения).
- Активные (`Новости`, `Рейтинг`, `ISmeta`) — `<Link>`, активный имеет `fontWeight 600`, акцентную подсветку снизу `2px` на `--rt-accent`.
- Белесые (5 шт.) — `<span>` с `color: hsl(var(--rt-ink-25))`, `cursor: default`, `pointer-events: none` (нельзя кликнуть, не рендерятся как ссылки).
- Правый блок — search icon / RU / moon icon / «Вход» как статические визуальные плейсхолдеры (без интерактивности — это Ф6A).
- Mobile: burger+search бар, десктопная навигация появляется c `min-width: 1024px` через inline `<style>`-блок (без client islands, чтобы остаться server component).
- Иконки (`SearchIcon`, `MoonIcon`, `MenuIcon`) — inline SVG из `wf-primitives.jsx:ICONS`, без зависимости от `lucide-react`.

`frontend/app/ratings/_components/ComingSoon.tsx` — простой блок-заглушка (eyebrow-фаза, H1 в serif, описание, ссылка на дизайн-исходник). Дедуп для 5 скелетных страниц.

Страницы (все SSR, по `ComingSoon`):

| Route | Файл | Фаза-тег | Ссылка на дизайн |
|---|---|---|---|
| `/ratings` | `app/ratings/page.tsx` (переписана с заглушки) | Ф6A | wf-listing.jsx — RatingListA |
| `/ratings/[slug]` | `app/ratings/[slug]/page.tsx` | Ф6B | wf-screens.jsx — DetailA |
| `/ratings/methodology` | `app/ratings/methodology/page.tsx` | Ф6C | wf-screens.jsx — Methodology |
| `/ratings/submit` | `app/ratings/submit/page.tsx` | Ф6C | wf-screens.jsx — SubmitForm |
| `/ratings/archive` | `app/ratings/archive/page.tsx` | Ф6C | wf-screens.jsx — Archive |

`[slug]` использует `params: Promise<{ slug }>` + `await params` — это требование Next.js 16 App Router (breaking change с 15).

### 4. TS-типы + минимальный API-клиент

`frontend/lib/api/types/rating.ts` — 9 интерфейсов:

- `RatingBrand`, `RatingRegion`, `RatingParameterScore`, `RatingModelPhoto`, `RatingModelSupplier`
- `RatingModelListItem` (включая `rank: number` — добавит Петя в M2)
- `RatingModelDetail extends RatingModelListItem` (включая `median_total_index: number` — M2)
- `RatingMethodologyCriterion`, `RatingMethodologyStats`, `RatingMethodology` (где `stats` — M2)
- `RatingReview`

`frontend/lib/api/services/rating.ts` — три функции через общий `ratingFetch<T>` с ISR `revalidate: 3600`:

- `getRatingModels()`
- `getRatingModelBySlug(slug)`
- `getRatingMethodology()`

`BASE` берётся из `process.env.NEXT_PUBLIC_BACKEND_URL ?? ''` — на проде префикс приходит извне, локально работает относительно dev-сервера.

**После merge M2** — свериться с реальным JSON-shape (поля могут слегка отличаться от моего прогноза). Я готов принять патч от Пети и подкрутить типы одним коммитом.

## Результаты проверок

| Проверка | Результат |
|---|---|
| `npx tsc --noEmit` | ✅ чисто (exit 0, без ошибок) |
| `npm run build` | ✅ `Compiled successfully in 6.7s`, все 5 rating-routes в output |
| `npm run dev` (port 3100) + curl | ✅ `/ratings`, `/ratings/lg-dualcool`, `/ratings/methodology`, `/ratings/submit`, `/ratings/archive` → HTTP 200, 54-55 KB HTML |
| header-инварианты на `/ratings` | ✅ найдены все 5 muted (Мешок Монтажников, Анализ проектов, Франшиза, Ассоциация, Стандарт монтажа) + ISmeta + класс `rating-scope` + тег «Фаза 6A» |
| фаза-теги правильные | ✅ Ф6A на /, Ф6B на [slug], Ф6C на methodology/submit/archive |
| git status (scope) | ✅ diff только в `frontend/app/ratings/**` и `frontend/lib/api/{types,services}/rating.ts` |

Build даёт одну нерегрессионную ошибку: `Sitemap generation error: TypeError: fetch failed · getaddrinfo ENOTFOUND backend` — это существующий sitemap скрипт пытается резолвить hostname `backend` при build, в моём окружении worktree backend не поднят. Компиляция успешна, routes собираются. К F0 отношения не имеет.

## Что НЕ сделано (осознанно)

- **Theme toggle / language toggle / search / burger drawer** — визуальные плейсхолдеры без логики. Интерактивность = client island, появится в Ф6A.
- **Donut / Meter / BrandLogo примитивы** — в ТЗ явно запрещено для F0, это Ф6A с реальными данными.
- **framer-motion / анимации** — Ф6A.
- **Tweaks-панель** (debug-переключатели темы/акцента/плотности) — dev-only, в prod не идёт.
- **Mobile drawer** — пока только иконка бургера без действия, полный drawer по `wf-nav.jsx:NavMobileDrawer` — в Ф6A.

## Известные риски / сюрпризы

1. **Разница между TZ и финальной реализацией по `--rt-*`.** В TZ предложены hex-значения, я перевёл всё в hsl (Tailwind 4-friendly, удобно красить через `hsl(var(--rt-*))`). Если в Ф6A окажется, что нужны raw-hex для каких-то SVG-стилей — добавлю второй слой переменных. Для F0 эквивалентно.
2. **Шрифты через `next/font/google`** добавляют ~3 сетевых запроса при билде (как указано в подсказке техлида, это правильный путь, self-hosted после build). Если CI в offline-контуре — фоллбэк на системные стоит в tokens.css (`Inter, system-ui`).
3. **`frontend/app/ratings/[slug]/page.tsx`** использует `params: Promise<{ slug }>` — это корректно для Next.js 16 App Router. Если ESLint-конфиг ругается — чинится как отдельная issue; `tsc --noEmit` чист.
4. **Header inline-media-query через `<style>`-блок.** Это компромисс, чтобы не делать `'use client'`. В Ф6A можно переехать на Tailwind utility-классы или оставить — не критично.
5. **Типы `RatingModelListItem.rank` и `RatingMethodology.stats`** — опережают M2. После merge M2 сверюсь с Петиным smoke-curl и, при необходимости, подкручу.

## Ключевые файлы для ревью

```
frontend/app/ratings/
├── _styles/tokens.css                 ← 1. токены
├── layout.tsx                         ← 2. layout + шрифты
├── _components/
│   ├── RatingHeader.tsx               ← 3. плоский header
│   └── ComingSoon.tsx                 ← общий блок-заглушка
├── page.tsx                           ← /ratings (заменил PublicLayout заглушку)
├── [slug]/page.tsx                    ← /ratings/:slug
├── methodology/page.tsx
├── submit/page.tsx
└── archive/page.tsx

frontend/lib/api/
├── types/rating.ts                    ← 4. TS-типы
└── services/rating.ts                 ← 4. API-клиент (3 функции)
```

Глобальные файлы (`frontend/app/globals.css`, `frontend/app/layout.tsx`, shadcn-компоненты, другие routes) — не тронуты, проверено `git status`.
