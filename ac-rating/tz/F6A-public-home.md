# ТЗ Фазы Ф6A — Публичная главная рейтинга

**Фаза:** Ф6A (frontend, главная `/ratings/`)
**Ветка:** `ac-rating/f6a-public-home` (от `main`)
**Зависит от:** M2 (в main), F0 (в main)
**Оценка:** 2.5-3 дня

## Контекст

F0 заложил фундамент: scoped-токены `.rating-scope`, RatingLayout с next/font, плоский RatingHeader (3 активных пункта + 5 белесых), 5 skeleton-routes, TS-типы + API-клиент с ISR 3600s. M2 от Пети добавил в API всё, что было в gap-списке дизайна:

- **list** — `rank` + уже есть `scores: dict[criterion_code → 0..100]`, `noise_score`, `has_noise_measurement`, `brand_logo` (абсолютный URL)
- **methodology** — `stats: {total_models, active_criteria_count, median_total_index}`
- **detail** — `rank`, `median_total_index` (пригодится в Ф6B, не сейчас)

Утверждённый дизайн главной — **LIST-A** (editorial таблица) + **CustomRatingB** («Свой рейтинг» tab) + **MobileListA** + **MobileCustomRating**. Источники: `ac-rating/design/wf-listing.jsx`, `ac-rating/design/wf-custom.jsx`, `ac-rating/design/wf-screens.jsx:1894-2028` (MobileListA), `ac-rating/design/wf-custom.jsx:393-560` (MobileCustomRating).

**Решения 2026-04-21 (зафиксировать):**
- **Фильтры** — сразу все 4: бренд, цена от/до, регион, мощность.
- **«Самые тихие»** — клиентская сортировка по `noise_score` в рамках уже загруженного массива (27 моделей в одном ответе). Backend-sort переедет в Ф10, если каталог перерастёт 100+ моделей.
- **Контент hero/SEO/авторы** — хардкод placeholder-текстами из вайрфреймов Максима. Правим контентом позже, не в Ф6A.
- **Mobile** — отдельные компоненты `DesktopListing` / `MobileListing` через Tailwind-обёртки (`hidden md:block` / `md:hidden`). Без `useMediaQuery` — чистый SSR.

## Что в скоупе Ф6A

### T1. Примитивы + типы (0.2 дня)

**`frontend/app/ratings/_components/primitives.tsx`** — переиспользуемые компоненты:

- `<Meter value={0..100} width={72} height={5} />` — горизонтальный бар, заливка `hsl(var(--rt-accent))` на ширину `value%`, фон `hsl(var(--rt-ink-15))`. Используется в listing-строке и CustomRating-таблице.
- `<BrandLogo src={url} name={string} size={28|32} />` — `<img>` с `object-fit: contain`, `max-height: size`. **Fallback**, если `src === ''`: квадрат `hsl(var(--rt-chip))` с первой буквой `name`, моно-шрифт.
- `<Eyebrow>{children}</Eyebrow>` — uppercase caption, 10px mono, `var(--rt-ink-40)`, letter-spacing 1.2.
- `<Pill active={bool} tone?>{children}</Pill>` — chip с бордером, активный получает `rt-accent`.
- `<H size={} serif?>` / `<T size={} weight={}>` — типографические обёртки.

Не тащи `wf-primitives.jsx` 1-в-1 — бери семантику, пиши на Tailwind + inline `style` только для scoped-vars.

**Обнови `frontend/lib/api/types/rating.ts`** — сейчас типы не матчат реальный API. Реальный shape list-элемента (из сериализатора `backend/ac_catalog/serializers.py:105-204`):

```ts
export interface RatingModelListItem {
  id: number;
  slug: string;
  brand: string;                // ВНИМАНИЕ: в list это string, не объект (в detail — объект)
  brand_logo: string;           // абсолютный URL или ''
  inner_unit: string;
  series: string;
  nominal_capacity: number | null;
  total_index: number;
  index_max: number;            // обычно 100
  publish_status: string;
  region_availability: RatingRegion[];
  price: string | null;         // Decimal → string
  noise_score: number | null;
  has_noise_measurement: boolean;
  scores: Record<string, number>;  // criterion_code → 0..100
  is_ad: boolean;
  ad_position: number | null;
  rank: number | null;          // null для не-published
}
```

Тип `RatingModelDetail` оставь для Ф6B, сейчас не трогаем.

### T2. Hero + tabs + filter bar (0.3 дня)

**`frontend/app/ratings/_components/HeroBlock.tsx`** (server component):

Grid 2 колонки (1fr / 320px) на ≥lg, на <lg — стек.
- Слева: eyebrow «Независимый рейтинг · обновление 04.2026», H1 serif 34px editorial text «Интегральный индекс "Август-климат" качества бытовых кондиционеров до 4,0 кВт на основе наших измерений и анализа параметров.», chip-row «О рейтинге: Как мы считаем / Архив моделей / Добавить модель» (первая активная/primary, остальные — бордер).
- Сверху справа три числа: `{stats.total_models}` моделей / `{stats.active_criteria_count}` критериев / `4` года замеров (4 — хардкод, в API не добавляли).
- Справа: `<AuthorsBlock />` — хардкод «Андрей Петров · главный редактор, инженер-теплотехник» + «Ирина Соколова · лаборатория акустики, к. т. н.», SVG-аватары-заглушки из wireframe (не пытаемся подставить реальные фото — их нет).

**`frontend/app/ratings/_components/RatingTabs.tsx`** (client): `['По индексу', 'Самые тихие', 'Свой рейтинг']`. URL-state через `useSearchParams` — `?tab=index|silence|custom` (по умолчанию `index`). `router.replace` при смене — не `push`, чтобы не захламлять history.

**`frontend/app/ratings/_components/FilterBar.tsx`** (client):

4 фильтра + CTA. URL-state для всех:
- `brand` — dropdown multiselect. Значения — уникальные `brand` из загруженных моделей (не отдельный API — экономим запрос).
- `price_min` / `price_max` — два number-инпута. Плейсхолдеры: `Math.min(...prices)` и `Math.max(...prices)` отформатированные как `21 700 ₽`.
- `region` — dropdown multiselect. Значения — из `model.region_availability`.
- `capacity` — dropdown singleselect с ступенями: `<3 кВт / 3-4 кВт / 4+ кВт` (сопоставить с `nominal_capacity`).
- Кнопка «+ Добавить модель» — `<Link href="/ratings/submit" />`.

Фильтрация — **клиентская** через `useMemo` от `useSearchParams` над полным массивом. Backend-фильтры у Максима работают, но мы не хотим плодить сетевые запросы при каждом щелчке чекбокса.

### T3. Desktop listing (LIST-A) (0.4 дня)

**`frontend/app/ratings/_components/DesktopListing.tsx`** (client, завёрнут в `<div className="hidden md:block">`):

Editorial таблица по гриду `56px 180px 60px 160px 1fr 140px 160px`:
- # (rank из API, mono)
- brand_logo (`<BrandLogo />`)
- gap
- Бренд (13px, weight 600)
- Модель (12px, `inner_unit`, цвет `rt-ink-60`)
- Цена (13px, weight 500, форматирование пробелом + ` ₽`)
- Индекс: `<Meter value={total_index} w={72} h={5} />` + 15px serif число цветом `rt-accent`

Padding строки `18px 0`, border-bottom `1px solid hsl(var(--rt-border-subtle))`. Клик по строке → `<Link href={`/ratings/${slug}`}>` (обёрнуть всю строку).

**Pagination:** client-side. Изначально 20 строк, кнопка «Показать ещё N моделей» догружает +20, N = `filtered.length - visible`. Когда visible ≥ filtered.length — кнопка пропадает.

**Сортировка:**
- tab=index → `[...].sort((a,b) => b.total_index - a.total_index)`
- tab=silence → `[...].sort((a,b) => (b.noise_score ?? 0) - (a.noise_score ?? 0))` + скрыть модели с `has_noise_measurement === false` (показывать подсказку «Для режима "Самые тихие" есть N моделей с лаб. замером»)
- tab=custom → передача управления в CustomRatingTab (T5)

### T4. Mobile accordion (0.3 дня)

**`frontend/app/ratings/_components/MobileListing.tsx`** (client, обёрнут в `<div className="md:hidden">`):

Hero упрощённый (18px padding, H 18px serif, 3 числа компактные), под ним tabs, под ним две кнопки-фильтра (Бренд / Цена) открывающие bottom-sheet drawer, список аккордеонов.

Каждый элемент — grid `34px 1fr auto`:
- rank (для топ-3 — 24px serif accent, для остальных — 13px mono ink-40)
- brand_logo + inner_unit (truncate ellipsis)
- index 16px serif accent + price 11px ink-60

При клике строки — раскрытие. **Внутри раскрытой строки НЕ делаем галерею фото** (фото только в detail): ставим CTA `<Btn>Открыть модель →</Btn>` → `/ratings/${slug}`.

Фильтр-drawer — `<dialog>` с `backdrop`, открывается снизу, внутри — bare-bones checkboxes по брендам / range-инпуты по цене / regions / capacity.

Footer раздела (3 группы «Прозрачность / Участие / Архив») — одна колонка с разделителями-линиями между ссылками, не три колонки.

### T5. «Свой рейтинг» tab (0.7 дня)

**`frontend/app/ratings/_components/CustomRatingTab.tsx`** (client, рендерится когда `?tab=custom`).

**Данные:**
- Критерии — из `methodology.criteria` (30 штук с `code`, `weight`, `name_ru`). Отсортировать по `weight DESC`.
- Оценки моделей — из `model.scores[criterion_code]` (уже 0..100).

**State:**
- `active: Set<string>` — коды включённых критериев. Default = все 30.
- `expanded: boolean` — панель критериев развёрнута. Default = true (дизайн так).

**Формула:**
```ts
function computeIndex(model: RatingModelListItem, active: Set<string>, criteria: RatingMethodologyCriterion[]): number {
  let num = 0, den = 0;
  for (const c of criteria) {
    if (!active.has(c.code)) continue;
    const s = model.scores[c.code];
    if (s == null) continue;  // нет данных — пропускаем
    num += c.weight * s;
    den += c.weight;
  }
  return den === 0 ? 0 : num / den;
}
```

Итоговый ранжированный список — `useMemo` от `(models, active, criteria)`.

**Summary bar:** счётчик активных (`{active.size}/30`), mini-progress-bar от суммы включённых весов / 100, пресет-чипы, кнопка «Настроить критерии ▾» (toggle expanded).

**Пресеты (PRESETS):** переиспользуй из `wf-custom.jsx:109-116` по смыслу, но привязывай к реальным `criterion_code` **не** к индексам `[0..29]`. Максим использовал массив с id; у нас коды. Сделай маппинг:
- `all` — все коды из methodology.
- `silence` — коды, у которых `weight >= 4` И связаны с шумом (по эвристике имени `code`, например `noise_level`, `inverter`, `fan_speeds`). Если маппинг по имени шаткий — **хардкодь коды словом**, не вычисляй.
- `cold` — критерии связанные с холодом (`heater_mode`, `evi_compressor`, `drip_tray_heater`, `cold_reserve_8c` и т.п.).
- `budget` — all МИНУС smart-критерии (`wifi`, `ionizer`, `uv_lamp`, `ir_sensor`, `alice_support`, `auto_freeze_clean`, `temp_sterilization`, `aromatizer`).
- `house` — `house`-критерии + `cold` + `engine`.
- `allergy` — allergy + engine.

**Конкретные code-маппинги** — в начале файла `CRITERIA_PRESETS: Record<preset, string[]>` с комментарием «см. brief-designer.md / wf-custom.jsx:7-44 — если у Максима код отличается от API, делать maping». Если какой-то код отсутствует в `methodology.criteria` — просто игнорировать в пресете (грацeful).

**Expandable drawer:** grid 3 колонки, чипы-критерии с checkbox, зачёркивание при `!active`, mono-weight `{c.weight}%` справа. `onClick` → toggle в `active`. «Включить все» / «Очистить».

**Таблица с дельтой:** grid `56px 180px 40px 160px 1fr 120px 130px 160px`. Колонка дельты показывает `base - score` (base = computeIndex при всех активных) со стрелкой ↑/↓ и `±N.N`, цвет `rt-ok` / `rt-warn`.

**FLIP-анимация:** copy-paste `useFlip` из `wf-custom.jsx:129-161` в `_components/useFlip.ts`. Ссылки строк на DOM через `register(id, el)`, орeдер-ключ — `rows.map(r => r.id).join(',')`. `useLayoutEffect` считает старые/новые позиции, анимирует `translateY` за 420ms `cubic-bezier(0.22, 0.61, 0.36, 1)`.

**Пустое состояние:** если `active.size === 0` — полноэкранный placeholder «Включите хотя бы один критерий…».

**Mobile-версия «Свой рейтинг»** (`MobileCustomRating` в `wf-custom.jsx:393-560`) — тот же state, но drawer с критериями — bottom-sheet overlay (не inline). Для Ф6A **хватит:** в mobile-tab-custom показываем компактный summary bar + кнопку «Настроить ▾» открывающую bottom-sheet, таблица — один столбец «rk / brand+model / score+base+price». Без галерей фото.

### T6. SEO-блок + section footer (0.1 дня)

**`frontend/app/ratings/_components/SeoBlock.tsx`** (server): editorial long-form из `wf-listing.jsx:131-156`. Хардкодим текст как есть. Максимальная ширина 760px.

**`frontend/app/ratings/_components/SectionFooter.tsx`** (server): 3 колонки «Прозрачность / Участие / Архив» (десктоп) / 1 колонка (mobile — см. T4). Ссылки пока ведут в никуда (`href="#"`) — это Ф6C-страницы.

### T7. Интеграция в page.tsx (0.1 дня)

**`frontend/app/ratings/page.tsx`** (server):

```tsx
import { getRatingModels, getRatingMethodology } from '@/lib/api/services/rating';
import RatingHeader from './_components/RatingHeader';
import HeroBlock from './_components/HeroBlock';
import DesktopListing from './_components/DesktopListing';
import MobileListing from './_components/MobileListing';
import SeoBlock from './_components/SeoBlock';
import SectionFooter from './_components/SectionFooter';

export default async function RatingHomePage() {
  const [models, methodology] = await Promise.all([
    getRatingModels(),
    getRatingMethodology(),
  ]);
  const publishedModels = models.filter(m => m.publish_status === 'published');

  return (
    <>
      <RatingHeader />
      <HeroBlock stats={methodology.stats} />
      <div className="hidden md:block">
        <DesktopListing models={publishedModels} methodology={methodology} />
      </div>
      <div className="md:hidden">
        <MobileListing models={publishedModels} methodology={methodology} />
      </div>
      <SeoBlock />
      <SectionFooter />
    </>
  );
}
```

**Удали `_components/ComingSoon.tsx`** — он был F0-заглушкой, больше не нужен.

## Приёмочные критерии

- [ ] `cd frontend && npx tsc --noEmit` — ноль ошибок
- [ ] `cd frontend && npm run build` — успешно, `/ratings/` рендерится как SSG/ISR (не dynamic)
- [ ] `cd frontend && npm run dev` → `http://localhost:3000/ratings/`:
  - [ ] Hero с 3 числами (27 / 30 / 4) из `stats` API
  - [ ] Tabs переключаются через URL (`?tab=silence`, `?tab=custom`)
  - [ ] Фильтры по бренду / цене / региону / мощности — работают, URL отражает состояние, результаты режутся
  - [ ] Desktop-таблица отображает 20 строк + «Показать ещё N моделей»
  - [ ] Клик по строке → `/ratings/<slug>/` (пусть страница — заглушка Ф6B)
  - [ ] «Самые тихие» режет моделей без замера и сортирует по `noise_score`
  - [ ] «Свой рейтинг»: переключение чипов пересчитывает индекс, FLIP-анимация плавная, пресеты применяются, пустое состояние работает
  - [ ] Mobile (ширина ≤767px): рендерится `MobileListing`, аккордеон раскрывается, `CustomRating` mobile-drawer открывается снизу
- [ ] Никаких изменений в `frontend/app/globals.css`, `frontend/app/layout.tsx` (корневой), `frontend/app/news/*`, `frontend/app/erp/*`, корневом `page.tsx`
- [ ] Плавная работа при переключении `.dark` на `<html>` (проверить DevTools → toggle `.dark` класс)
- [ ] Lighthouse на `/ratings/` (локально, mobile emulation): Performance ≥85, Accessibility ≥90, Best Practices ≥95. SEO не цель (meta пишем, но meta-title/OG полноценные будут в Ф7).

## Ограничения

- **НЕ менять** `globals.css`, `layout.tsx` (корневой), `page.tsx` (корневой)
- **НЕ менять** `settings.py`, `urls.py`, `docker-compose.yml`, `.env.example`, `CLAUDE.md` (shared с IS-командой, пинг Андрею если понадобится)
- **НЕ использовать** `framer-motion` / другие анимационные либы — FLIP руками
- **НЕ использовать** `useMediaQuery` — mobile/desktop разводим CSS-обёртками
- **НЕ трогать** shadcn-компоненты в `frontend/components/ui/`
- **НЕ импортировать** код из `ac-rating/review/` или `ac-rating/design/` — это spec, читаем глазами, пишем свой TS
- **НЕ добавлять** новые endpoints к API — всё что нужно, уже есть после M2
- Все цвета — через `hsl(var(--rt-*))`. Shadcn-токены (`--primary`, `--background`) не трогать
- Conventional Commits, по одному коммиту на подзадачу (T1…T7). Git-trailer `Co-authored-by: AC-Федя <ac-fedya@erp-avgust>`
- `ac-rating/review/` игнорируем как исходник — это код Максима, у нас свой

## Формат отчёта

`ac-rating/reports/f6a-public-home.md`:
1. Ветка + коммиты (7 штук по подзадачам)
2. Что сделано — T1…T7 кратко
3. Проверки: `tsc --noEmit` + `npm run build` + скриншоты golden-path (hero / desktop-table / «Свой рейтинг» с анимацией / mobile-accordion / mobile-drawer)
4. Lighthouse-скриншот
5. Сюрпризы / риски / TODO для Ф6B/C
6. Ключевые файлы для ревью (список с комментариями)

## Подсказки от техлида

- **SSR vs client islands:** `page.tsx` — server, fetch через `Promise.all` для параллельного получения. `HeroBlock` / `SeoBlock` / `SectionFooter` — server. `RatingTabs` / `FilterBar` / `DesktopListing` / `MobileListing` / `CustomRatingTab` — `'use client'` (им нужен `useSearchParams`).
- **Передача данных в client:** `<DesktopListing models={publishedModels} methodology={methodology} />` — server сериализует prop в JSON и встраивает в `__NEXT_DATA__`. Без `'use client'` в `DesktopListing.tsx` не сработает, если внутри есть `useState/useRouter`.
- **URL state:** `useSearchParams()` + `const sp = new URLSearchParams(searchParams); sp.set('brand', 'LG'); router.replace('/ratings/?' + sp.toString(), { scroll: false })`. Scroll=false важен — не хотим прыжка при смене фильтра.
- **SEO-friendly URLs:** фильтры в query work: Google видит `/ratings/?brand=LG&tab=silence` как отдельный URL, но это не критично для MVP — если понадобится rich-indexing, переведём на route-segments в Ф10.
- **Форматирование цены:** `new Intl.NumberFormat('ru-RU').format(Number(price))` + ` ₽`. Не через split/reverse/chunks.
- **Brand фильтр значения:** не дублируй — `[...new Set(models.map(m => m.brand))].sort()`.
- **FLIP-хук:** у Максима он шарится между `CustomRatingB` и `MobileCustomRating`. У нас — один `_components/useFlip.ts`, импортируется в обе таблицы.
- **`methodology.criteria` ordering:** API возвращает в порядке `order ASC`. Если нужно по `weight DESC` (как у Максима в drawer) — сортируй на клиенте.
- **Mobile breakpoint:** дизайн — 390px (iPhone width). Тест-ширины: 390 / 768 / 1024 / 1280 / 1440. На 1024 должен быть desktop-режим (`md` — 768). На 768 ровно — по соглашению Tailwind это desktop начинается.
- **Dark mode:** shadcn-переменные на `<html>.dark` — это уже есть в F0 (`.dark .rating-scope` внутри `tokens.css`). Проверь вручную: DevTools → добавь класс `dark` на `<html>`.
- **Перф:** 27 моделей × 30 scores = 810 точек data для ре-сортировки «Свой рейтинг». `useMemo` + FLIP стабилен. Если дойдём до 500+ моделей — пересмотрим (Ф10).
- **`brand: string` vs объект:** в list — строка, в detail — объект. Это легаси-решение Максима (мы не переделываем). Учти в типах Ф6B.
- **wf-custom.jsx:7-44** — там массив `CUSTOM_CRITERIA` с id 0..29 и тегами. ID-ам соответствуют реальные критерии Максима по порядку, но теги (`engine/silence/cold/house/smart/allergy/service`) нужны только для пресетов. У тебя в methodology — коды типа `heat_exchanger_inner`, `inverter`, `noise_level` и т.п. Задай пресет-группы руками через коды, не через порядок.
- **Не забывай rt-scope:** любой новый компонент Ф6A рендерится внутри `RatingLayout`, у которого className `rating-scope`. Значит `hsl(var(--rt-*))` работает автоматически, не нужно вешать `.rating-scope` на каждый компонент.
- **Тесты:** frontend-юнит-тестов пока в проекте мало; Ф6A напишет минимум один smoke-test для `computeIndex` (checkov: вес 0, один критерий, все критерии). Jest/Vitest в ERP пока не настроен сквозной — если захочется, setup можно сделать отдельным PR после Ф6A.
