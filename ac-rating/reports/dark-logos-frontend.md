# Polish-2: Dark-theme brand logos — Frontend

**Агент:** AC-Федя
**Ветка:** `ac-rating/dark-logos-frontend`
**База:** `origin/main`
**Статус:** готово к мержу (ждёт Петю по порядку — backend сначала).

## Что сделано

### 1. Types (`frontend/lib/api/types/`)

- `RatingBrand.logo_dark?: string` — optional, появится в ответе API после мержа backend PR.
- `RatingModelListItem.brand_logo_dark?: string` — inline-версия для быстрой отрисовки в таблице.
- `HvacNewsMentionedAcModel.brand_logo_dark?: string` — для карточек упомянутых моделей в новостях.

Все поля optional, чтобы фронт работал и до, и после мержа Пети.

### 2. Компонент `BrandLogo` (`ratings/_components/primitives.tsx`)

Новая сигнатура:
```tsx
<BrandLogo
  src={model.brand_logo}
  srcDark={model.brand_logo_dark}   // optional
  name={model.brand}
  size={28}
/>
```

Режимы рендера:
1. **Нет `src`** — текстовый placeholder с первой буквой (как было).
2. **`src` есть, `srcDark` пустой/undefined/null** — один `<img class="rt-brand-logo-single">`. CSS `.dark .rt-brand-logo-single { filter: invert(1) hue-rotate(180deg) }` автоматически инвертирует monochromatic-лого в тёмной теме.
3. **`src` + `srcDark`** — два `<img>`: `.rt-brand-logo-light` (видим) + `.rt-brand-logo-dark` (скрыт, с `aria-hidden="true"` чтобы screenreader не дублировал бренд). CSS-тоггл в `.dark` меняет видимость.

### 3. CSS (`ratings/_styles/tokens.css`)

Добавлены 4 правила после блока `.dark .rating-scope`:
```css
.rt-brand-logo-dark { display: none; }
.dark .rt-brand-logo-light { display: none !important; }
.dark .rt-brand-logo-dark { display: block !important; }
.dark .rt-brand-logo-single { filter: invert(1) hue-rotate(180deg); }
```

Паттерн идентичен `HvacInfoHeader.tsx::.rt-logo-light/.rt-logo-dark` (там же переключается главный логотип HVAC Info).

### 4. Использования (9 call-sites)

| Файл | Строк изменено |
|------|----------------|
| `ratings/_components/DesktopListing.tsx` | 1 → 6 |
| `ratings/_components/MobileListing.tsx` | 1 → 6 |
| `ratings/_components/DetailHero.tsx` | 3 × (1→6) |
| `ratings/_components/DetailRelated.tsx` | 1 → 6 |
| `ratings/_components/CustomRatingTab.tsx` | 2 × (1→6) |
| `news/[id]/_components/NewsMentionedModelCard.tsx` | 2 × (1→6) |

### 5. Тесты

Новый файл `ratings/_components/primitives.test.tsx` — 10 тестов:

| # | Сценарий |
|---|----------|
| 1 | `src=''` без name → placeholder с буквой бренда |
| 2 | `src=''` без name → fallback `·` |
| 3 | `src` без `srcDark` → один `<img>` с классом `rt-brand-logo-single` |
| 4 | `srcDark=null` → один `<img rt-brand-logo-single>` |
| 5 | `srcDark=''` → один `<img rt-brand-logo-single>` |
| 6 | `src` + `srcDark` → два `<img>` (-light visible, -dark hidden; dark имеет `aria-hidden`) |
| 7 | Оба img при dual-mode получают одинаковые size constraints |
| 8 | `size=28` → `maxHeight: 28px` |
| 9 | Light-img не получает `aria-hidden` (основной для screenreader) |
| 10 | Single-img тоже без `aria-hidden` |

**Полный ratings-suite: 116 passed** (было 106 до задачи, +10 новых).

## Verification

- `npx tsc --noEmit`: clean (никаких ошибок).
- `npx vitest run --dir 'app/(hvac-info)/ratings'`: 12 files, 116 tests, all pass.
- Live dev-server (`localhost:3100` → прод API):
  - Прод API пока не отдаёт `brand_logo_dark` → все лого получают `rt-brand-logo-single` → CSS-invert fallback срабатывает.
  - Injected test (manual): два `<img>` с классами `-light`/`-dark` корректно переключаются через `computedStyle.display`:
    - `.dark` → light: `none`, dark: `block`.
    - `:root.light` → light: `block`, dark: `none`.

## Screenshots

| Тема | Viewport | Файл |
|------|----------|------|
| Light | Desktop 1440×900 | `ac-rating/reports/screenshots/dark-logos-light-desktop.png` |
| Dark | Desktop 1440×900 | `ac-rating/reports/screenshots/dark-logos-dark-desktop.png` |
| Light | Mobile 390×844 | `ac-rating/reports/screenshots/dark-logos-light-mobile.png` |
| Dark | Mobile 390×844 | `ac-rating/reports/screenshots/dark-logos-dark-mobile.png` |
| Dark | Detail page 1440×900 (CASARTE) | `ac-rating/reports/screenshots/dark-logos-dark-detail.png` |

В dark-desktop видно: Kalashnikov / FeRRUM / AUX / Rovex / Viomi / Coolberg / CENTEK / Just Aircon / JAX — все теперь белые (инверсия) и читаемы. В light-desktop — Casarte, FUNAI, THAICON, LG, MDV, AQUA — естественные цветные логотипы. Detail-page dark: лого CASARTE в hero стал белым (до фикса был чёрный на тёмном).

## Что будет после мержа Пети

Сейчас (до backend merge):
- `brand_logo_dark` приходит undefined → все 22 бренда используют CSS-invert fallback.
- Для monochromatic логотипов (Casarte, MHI, Haier, Kalashnikov, FeRRUM, CENTEK, JUST, Rovex, Coolberg, MDV и т.д. — около 18 из 22) fallback даёт хорошую читаемость.
- Для цветных логотипов (LG с красным кругом, Midea синий с зелёным, Royal Clima бордовый на жёлтом — ~4) fallback искажает цвета, но контраст сохраняется. Качество "приемлемо для MVP".

После backend merge:
- Петя сгенерирует `logo_dark` для ~18 monochromatic → они получат идеальную белую recolor-версию.
- Для 4 цветных оставит `logo_dark=''` (`force_colored` флаг в management-команде) → они **оставят оригинал + CSS-invert**, либо останутся с оригиналом (если Петя форсит `force_colored` без recolor). В любом случае фронт ничего не ломает.

## Коммиты

1. `6b3c834` feat(ratings): add optional logo_dark to Rating types
2. `5fc73e3` feat(ratings): BrandLogo rendering dark version + CSS toggle
3. `70a9593` feat(ratings): pass brand_logo_dark to all BrandLogo usages
4. `c734dd4` test(ratings): BrandLogo covers light/dark render modes

## Blockers

Нет. Ждём Петю (backend dark-logos), чтобы смержить в main в правильном порядке:
1. Петя: `ac-rating/dark-logos-backend` → main
2. Я (Федя): `git fetch origin && git rebase origin/main && git push`
3. Техлид мержит `ac-rating/dark-logos-frontend` → main.

## Затронутые файлы

- `frontend/lib/api/types/rating.ts`
- `frontend/lib/api/types/hvac.ts`
- `frontend/app/(hvac-info)/ratings/_components/primitives.tsx`
- `frontend/app/(hvac-info)/ratings/_components/primitives.test.tsx` (новый)
- `frontend/app/(hvac-info)/ratings/_styles/tokens.css`
- `frontend/app/(hvac-info)/ratings/_components/DesktopListing.tsx`
- `frontend/app/(hvac-info)/ratings/_components/MobileListing.tsx`
- `frontend/app/(hvac-info)/ratings/_components/DetailHero.tsx`
- `frontend/app/(hvac-info)/ratings/_components/DetailRelated.tsx`
- `frontend/app/(hvac-info)/ratings/_components/CustomRatingTab.tsx`
- `frontend/app/(hvac-info)/news/[id]/_components/NewsMentionedModelCard.tsx`
