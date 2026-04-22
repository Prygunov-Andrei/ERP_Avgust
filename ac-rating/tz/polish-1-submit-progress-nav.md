# Polish-1: Submit Section Progress Nav

**Исполнитель:** AC-Федя (frontend)
**От:** origin/main (commit `d8a37c9` или новее)
**Worktree:** `ERP_Avgust_ac_fedya_submit_progress`
**Ветка:** `ac-rating/submit-progress-nav`

## Контекст

На странице `/ratings/submit/` (forms.submit) под Hero сейчас декоративная полоса из 5 бейджей 01–05 («Модель» / «Характеристики» / «Теплообменник внутр.» / «Теплообменник наруж.» / «Подтверждение»). Они статичные (`<span>`, не кликабельны), уходят вверх при скролле вместе с формой — бесполезный элемент. Андрей утвердил превратить их в **прогресс-бар заполнения секций**.

Текущая разметка: `frontend/app/(hvac-info)/ratings/submit/SubmitForm.tsx:354-394`.

Форма уже разбита на 5 секций через компонент `Section num="01" title="…"` (строки 402, 503, 624, 671, 734). `Section` сейчас — просто `<div>` без id — нужно добавить.

## Задача

Превратить 5 бейджей в **sticky-панель прогресса** со следующим поведением:

1. **Кликабельность** — клик по бейджу плавно скроллит к соответствующей секции (`behavior: 'smooth'`, учесть height collapsed hero — offset сверху ~60px чтобы заголовок секции не прятался под прилипшей панелью).
2. **Sticky** — при прокрутке прилипает к top:0 под collapsed-hero (используй тот же паттерн что в `StickyCollapseHero`: либо встроить в `children` StickyCollapseHero, либо отдельный sticky-блок ниже). **Предпочтительно:** добавить в `StickyCollapseHero` как `children` — тогда навигация наследует поведение collapse-hero.
3. **Filled-state (главное!)** — если все обязательные поля секции заполнены, бейдж закрашивается:
   - `background: hsl(var(--rt-accent))` (teal `#2856cc` или текущий акцент)
   - `color: hsl(var(--rt-paper))` (белый текст)
   - `border-color: transparent`
   - Можно добавить галочку ✓ слева от номера (SVG 10×10, `stroke=currentColor`).
4. **Active-state (во время скролла)** — текущая видимая секция подсвечивается рамкой (border 1.5px accent, но background остаётся прозрачным если секция не заполнена). Используй `IntersectionObserver` — см. `frontend/app/(hvac-info)/ratings/_components/DetailAnchorNav.tsx` как образец.
5. **Mobile** — на `<768px` панель скроллится горизонтально (`overflow-x: auto`), бейджи не переносятся. Active-state при скролле должен автоскроллить активный бейдж в viewport панели (`scrollIntoView({ inline: 'nearest' })`).

## Mapping обязательных полей (из `isFormReady` + структуры секций)

Состояние валидности секций — вычисляется из `FormState` и `photos` в `SubmitForm`. Вынеси helper-функции рядом с `isFormReady`:

```ts
export type SubmitSectionId = '01' | '02' | '03' | '04' | '05';

export function isSectionComplete(
  id: SubmitSectionId,
  state: FormState,
  photos: File[],
): boolean {
  // 01 Модель
  if (id === '01') {
    if (!state.brand && !state.custom_brand_name.trim()) return false;
    return ['inner_unit', 'outer_unit', 'compressor_model', 'nominal_capacity_watt']
      .every((f) => (state[f as keyof FormState] as string).trim() !== '');
  }
  // 02 Характеристики
  if (id === '02') {
    if (state.erv === null) return false;
    if (state.fan_speed_outdoor === null) return false;
    if (state.remote_backlight === null) return false;
    return ['drain_pan_heater', 'fan_speeds_indoor', 'fine_filters',
            'ionizer_type', 'russian_remote', 'uv_lamp']
      .every((f) => (state[f as keyof FormState] as string).trim() !== '');
  }
  // 03 Теплообменник внутр.
  if (id === '03') {
    return ['inner_he_length_mm', 'inner_he_tube_count', 'inner_he_tube_diameter_mm']
      .every((f) => (state[f as keyof FormState] as string).trim() !== '');
  }
  // 04 Теплообменник наружн.
  if (id === '04') {
    return ['outer_he_length_mm', 'outer_he_tube_count',
            'outer_he_tube_diameter_mm', 'outer_he_thickness_mm']
      .every((f) => (state[f as keyof FormState] as string).trim() !== '');
  }
  // 05 Подтверждение
  if (id === '05') {
    return photos.length >= 1 && state.submitter_email.trim() !== '' && state.consent;
  }
  return false;
}
```

**Оптимизация:** `useMemo` на массив `completeness: Record<SubmitSectionId, boolean>` зависит от `state + photos`, переcчитывается на каждом рендере `SubmitForm`.

## Структура изменений

### 1. `SubmitForm.tsx`

- Добавить id каждой `<Section>`:
  ```tsx
  function Section({ num, title, children }) {
    return <div id={`submit-section-${num}`} style={…}>…</div>;
  }
  ```
- Экспортировать `isSectionComplete` (для тестов).
- Удалить старую полосу бейджей (строки 354-394). Вместо неё рендерим новый компонент `<SubmitSectionNav completeness={…} />` (но физически в DOM нет — он живёт в `StickyCollapseHero.children`, см. п. 3).
- `SubmitForm` — компонент клиентский, принимает `brands` props. Он же должен вычислять `completeness` и передавать в nav. **Проблема:** nav живёт в `page.tsx` (server), а `completeness` зависит от state, который в client. **Решение:** либо
  - **Вариант A:** весь hero+nav вынести внутрь SubmitForm (client) — тогда `page.tsx` рендерит только `<SubmitForm brands={brands} />`, а SubmitForm рендерит `<StickyCollapseHero full={<SubmitHero />} collapsed={<SubmitHeroCollapsed />}><SubmitSectionNav completeness={c} /></StickyCollapseHero>` + сам form.
  - **Вариант B:** отдельный context/ref-bridge.

  **Выбрать вариант A — проще.** Перенести `HvacInfoHeader`/`BackToRating`/`Hero`/`SectionFooter` оставить в page.tsx, а `StickyCollapseHero` + hero + nav + form — всё внутри `<SubmitForm>`. Или точнее: пусть `SubmitForm` экспортирует обёртку `<SubmitFormWithNav>` которая умеет sticky-nav. Дизайн reshape по вкусу — главное, чтобы state был доступен для nav.

### 2. Новый компонент: `frontend/app/(hvac-info)/ratings/submit/SubmitSectionNav.tsx` (client)

Props:
```ts
type Props = {
  completeness: Record<SubmitSectionId, boolean>;
};
```

Render 5 бейджей:
```tsx
const SECTIONS: Array<{ id: SubmitSectionId; label: string }> = [
  { id: '01', label: 'Модель' },
  { id: '02', label: 'Характеристики' },
  { id: '03', label: 'Теплообменник внутр.' },
  { id: '04', label: 'Теплообменник наруж.' },
  { id: '05', label: 'Подтверждение' },
];
```

Внутри — кнопка `<a href="#submit-section-{id}">` c onClick preventDefault + smoothScrollToElement.

Style active-state и filled-state через `data-active`, `data-filled` атрибуты + inline styles (или CSS-в-style-теге).

Active via IntersectionObserver: наблюдаем `#submit-section-01`..`05`, берём первый видимый с топа (rootMargin `-80px 0px -50% 0px` обычно работает).

### 3. `page.tsx` — минимальные правки, но передача collapsed/full hero в SubmitForm.

Если выбрал вариант A, то:
```tsx
return (
  <>
    <HvacInfoHeader />
    <main className="hvac-content"><BackToRating /></main>
    <SubmitForm brands={brands} />
    <SectionFooter />
  </>
);
```

И внутри `SubmitForm` рендерится `<StickyCollapseHero full={<SubmitHero />} collapsed={<SubmitHeroCollapsed />}><SubmitSectionNav … /></StickyCollapseHero>` перед `<form>`.

### 4. Тесты

- `SubmitSectionNav.test.tsx` — render 5 бейджей, verify filled/active classes per props, click skip-scroll (mock scrollIntoView), горизонтальный скролл на mobile (matchMedia mock + `offsetLeft` setter).
- `submitForm.helpers.test.ts` (новый или дополнить существующий) — `isSectionComplete` для каждой секции: empty → false; partial → false; full → true; «brand OR custom_brand_name» логика секции 01.

## Visual reference

Посмотри на `DetailAnchorNav.tsx` (`frontend/app/(hvac-info)/ratings/_components/DetailAnchorNav.tsx`) — там уже есть похожий sticky + IntersectionObserver + теал-accent. Переиспользуй паттерн, но стилизация бейджей — квадратиков (padding 6px 12px, border-radius 3px), не кнопок-ссылок.

## Acceptance

- [ ] На `/ratings/submit/` над формой — sticky-полоса с 5 бейджами, прилипает к верху при скролле (под collapsed hero).
- [ ] Заполнил все обязательные поля секции «01 Модель» → бейдж «01 Модель» закрашивается teal.
- [ ] Очистил одно поле → бейдж сразу возвращается в пустое состояние.
- [ ] Клик по «03 Теплообменник внутр.» — smooth-scroll к соответствующей секции, её заголовок виден (не спрятан под nav).
- [ ] При прокрутке бейдж активной секции получает teal-обводку (если не filled) или visual-active-marker если filled.
- [ ] Mobile (≤767px): панель скроллится горизонтально, 5 бейджей в строку, активный автоскроллится в viewport.
- [ ] `npm run build` успешен, `npx tsc --noEmit` чист.
- [ ] Тесты vitest зелёные (новые + существующие ratings-suite — сейчас 81 тест).
- [ ] Manual QA: заполни форму поэтапно — каждый шаг визуально даёт feedback. Скриншот до/после заполнения каждой секции.

## Estimate

0.5-0.8 дня.

## Отчёт

После завершения:
- Краткий отчёт в `ac-rating/reports/submit-progress-nav.md` — что сделано, какие нюансы (например, edge-case если активных секций несколько).
- 4 скриншота: empty state / 2 секции заполнены / все заполнены / mobile. В `ac-rating/reports/submit-progress-nav-screens/`.
- Push в ветку `ac-rating/submit-progress-nav`, я мержу `--no-ff` в main.
