# TASK — Wave 8 frontend — 7 задач после тест-прохода Андрея

## 1. Tab switcher на SEO-страницах рейтинга

### Контекст
Андрей: «переход из рейтинга "по индексу" в "Самые тихие" работает, но если нажать ссылку "самые тихие" внизу страницы, то открывается /quiet — оттуда **нельзя вернуться на "По индексу"**».

`/quiet`, `/price/*`, `/preset/*` — отдельные SEO-страницы (Эпик F). На них **нет** tab-bar как на `/rating-split-system/`.

### Фикс
На SEO-страницах добавить такой же `RatingTabs` (или похожий компонент) — выбранный таб соответствует контексту страницы:
- `/quiet` → активен таб «Самые тихие». Клик «По индексу» → `/rating-split-system/`. Клик «Свой рейтинг» → `/rating-split-system/?tab=custom` (или какой URL у вкладки на главной).
- `/price/do-XXXXX-rub` → активен таб «По индексу» (или «Цена»? выбрать логично) — но клик «Самые тихие» → `/quiet`, «Свой рейтинг» → главная с custom.
- `/rating-split-system/preset/<slug>` → активен таб «Свой рейтинг» (это и есть пресеты «Свой рейтинг»). Клик «По индексу» → `/rating-split-system/`, «Самые тихие» → `/quiet`.

**Реализация:**
- В `frontend/app/(hvac-info)/rating-split-system/_components/` найти существующий `RatingTabs` (или как он называется) — он должен принимать `currentTab` пропом.
- Использовать его на `/quiet/page.tsx`, `/price/[slug]/page.tsx`, `/rating-split-system/preset/[slug]/page.tsx` с правильным `currentTab`.

### Если RatingTabs не существует
Найти UI-блок с табами на `/rating-split-system/page.tsx` (главная). Возможно это не отдельный компонент, а inline. Тогда:
- Вынести в shared-компонент `frontend/app/(hvac-info)/rating-split-system/_components/RatingTabs.tsx`.
- Принимает `current: 'index' | 'quiet' | 'custom'`.
- Каждый клик `<Link>` → соответствующий URL.

---

## 2. Реклама без индекса в листингах

### Контекст
Сейчас рекламные модели (is_ad=true) в листингах показывают:
- IndexBar (полоска)
- Числовое значение индекса
- Плашка «РЕКЛАМА» (слева)

Андрей хочет:
- **Убрать** IndexBar и числа.
- Заменить их на **плашку «реклама»** справа (mirror плашке слева).

### Фикс
Файл `frontend/app/(hvac-info)/rating-split-system/_components/ListItem.tsx` (или ListRow / DesktopListing — найти где рендерится строка модели).

Условный рендер:
```tsx
{isAd ? (
  <div className="rt-ad-badge-right">реклама</div>
) : (
  <>
    <IndexBar value={totalIndex} />
    <span className="index-number">{totalIndex.toFixed(1)}</span>
  </>
)}
```

Стилизация плашки справа: same look как левая («РЕКЛАМА» monoширин uppercase) с `rt-ad-badge` token (yellow). Просто другой position.

Проверь в обоих стилях — desktop и mobile.

---

## 3. Detail UI: «ФОТО ГАЛЕРЕЯ» badge + arrows в темной

### Контекст
В детальной странице модели `/rating-split-system/[slug]/`:
- На фото-галерее badge «ФОТО ГАЛЕРЕЯ» (не нужен).
- Стрелки prev/next в dark-mode становятся белыми кружочками без контраста — нечитаемо.

### Фикс
Файл `frontend/app/(hvac-info)/rating-split-system/_components/DetailMedia.tsx` (или похожий).

- Удалить badge «ФОТО ГАЛЕРЕЯ».
- Стрелки: в dark-mode добавить `bg-black/60` или подобный контрастный фон на кнопке стрелки. Иконка должна быть видна.

---

## 4. Pros/Cons dark mode нечитаемо

### Контекст
В детальной странице блок «Плюсы/Минусы» — белый шрифт на бледно-зелёном/бледно-красном (на тёмной теме). Не читается.

### Фикс
Файл `frontend/app/(hvac-info)/rating-split-system/_components/DetailEditorial.tsx` (или ProsConsBlock).

В dark-mode либо:
- (a) **Тёмный текст** на бледном фоне (классика).
- (b) **Насыщенный фон** (зелёный 600+, красный 600+) с белым текстом.

Проще (a) — текст становится тёмно-зелёным/тёмно-красным на бледном фоне. CSS:
```css
.dark .pros-block {
  color: hsl(140 50% 25%);   /* dark green */
  background: hsl(140 30% 88%);
}
.dark .cons-block {
  color: hsl(0 50% 30%);     /* dark red */
  background: hsl(0 30% 88%);
}
```

(Точные hsl значения подбери через DevTools под текущие токены `--rt-*`.)

---

## 5. Памятка в CriterionEditor про custom_scale_json (#6)

### Контекст
Андрей просит: в `ACCriterionEditor` для критериев типа `categorical` показать короткую инструкцию про настройку значений (где их редактировать).

### Фикс
Файл `frontend/components/hvac/pages/ACCriterionEditor.tsx`.

Когда `value_type === 'categorical'` (или value_type ∈ ['categorical', 'custom_scale']) — показать Card-памятку:

```tsx
{(form.value_type === 'categorical' || form.value_type === 'custom_scale') && (
  <Card className="p-4 bg-blue-50 dark:bg-blue-950/30 border-blue-200">
    <div className="flex gap-3">
      <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
      <div className="text-sm">
        <strong className="block mb-1">Как задать варианты значений и баллы за них</strong>
        <p className="text-muted-foreground">
          Этот критерий — категориальный. Конкретные варианты (например «Нет» / «Щеточка» /
          «Отдельный прибор» для ионизатора) и баллы за них (0 / 50 / 100) задаются в
          <strong> JSON-шкале </strong> внутри методики, по полю
          <code className="px-1 py-0.5 mx-1 bg-muted rounded text-xs">custom_scale_json</code>.
        </p>
        <p className="mt-2 text-muted-foreground">
          Сейчас редактирование доступно только через старую Django-админку:
        </p>
        <a 
          href="/hvac-admin/ac_methodology/methodologyversion/1/change/"
          target="_blank"
          rel="noopener"
          className="inline-block mt-2 text-blue-600 hover:underline font-mono text-xs"
        >
          /hvac-admin/ac_methodology/methodologyversion/1/change/ →
        </a>
        <p className="mt-2 text-xs text-muted-foreground">
          Найди этот критерий в inline-таблице → поле «Custom scale json» → впиши:
          <br />
          <code className="block mt-1 p-2 bg-muted rounded text-xs">{`{"Нет": 0, "Щеточка": 50, "Отдельный прибор": 100}`}</code>
        </p>
      </div>
    </div>
  </Card>
)}
```

(Текст скорректируй — главное смысл: инструкция короткая, ссылка прямая.)

---

## 6. Photo критерия в публичной /methodology/ не рендерится (#7)

### Контекст
Backend API `/api/public/v1/rating/methodology/` возвращает `photo_url: '/media/ac_rating/criteria/...'` для критерия `heat_exchanger_inner` (Андрей загрузил фото). Но на странице `/rating-split-system/methodology/` фото **не показывается**.

### Расследование
Посмотри `frontend/app/(hvac-info)/rating-split-system/methodology/page.tsx` (или соответствующий компонент). Найди где раскрытый критерий показывается. Проверь:
- Использует ли компонент поле `photo_url` из API?
- Есть ли условный рендер `{photo_url && <img />}` ?
- Если есть — проверь что URL не битый (URL-encoded русский в имени файла должен корректно работать в `<img src=...>`).

### Фикс
Если рендер photo отсутствует — добавить:
```tsx
{criterion.photo_url && (
  <img
    src={criterion.photo_url}
    alt={criterion.name_ru}
    className="..."
    style={{ width: '100%', maxWidth: 400, height: 'auto', borderRadius: 8 }}
  />
)}
```

(Размер/позиция по дизайну.)

---

## 7. Footer SEO ссылки на главной hvac-info.com (#10)

### Контекст
В подвале `hvac-info.com` нет ссылок на:
- `/robots.txt`
- `/sitemap.xml`
- `/llms.txt`
- `/llms-full.txt`

Все 4 файла **существуют** на проде (200 OK по прямым URL). Нужно их сделать видимыми в подвале для поисковиков/AI-агентов.

### Фикс
Найти Footer компонент (`frontend/app/(hvac-info)/_components/Footer.tsx` или похожее). Добавить секцию:

```tsx
<div className="footer-seo-links">
  <span className="text-xs text-muted-foreground mb-1">Для поисковых агентов:</span>
  <ul className="flex flex-wrap gap-3 text-xs">
    <li><a href="/robots.txt" className="hover:underline">robots.txt</a></li>
    <li><a href="/sitemap.xml" className="hover:underline">sitemap.xml</a></li>
    <li><a href="/llms.txt" className="hover:underline">llms.txt</a></li>
    <li><a href="/llms-full.txt" className="hover:underline">llms-full.txt</a></li>
  </ul>
</div>
```

(Стилизация в логике существующего Footer.)

---

## 8. Прогон

```bash
cd frontend
npx tsc --noEmit
npm test -- --run                      # все зелёные
```

Локально проверь в браузере (если получится поднять dev-сервер):
- /quiet → видно tab-switcher
- /rating-split-system/[slug] → плюсы/минусы читаемо в dark
- ACCriterionEditor с value_type=categorical → памятка
- /rating-split-system/methodology/ → фото `heat_exchanger_inner` появилось
- Footer главной → 4 ссылки

---

## Что НЕ делаем

- ❌ Не трогаем backend (engine, news writer) — это Петя в Wave 8 backend.
- ❌ Не делаем UI редактор JSON-шкалы — Wave 9 (отдельный эпик).
- ❌ Не делаем SEO-страницы пресетов — уже работают.

---

## Известные нюансы

1. **DEPLOY — строго по команде Андрея.** Он работает с новостями.
2. **Tab switcher для /preset/[slug]/** — там логично активен таб «Свой рейтинг» (это и есть пресеты этой вкладки), но как переключатель — клик «Свой рейтинг» возвращает на главную с этим табом, или просто остаётся на текущем пресете? Решай по UX — лучше клик «Свой рейтинг» = `/rating-split-system/?tab=custom` (главная), `/preset/silence` остаётся другой страницей с прямой SEO-навигацией.
3. **DetailMedia arrows** — в существующем коде arrows иконки (ChevronLeft / ChevronRight). В dark mode фон становится белый — нужно поменять.
4. **CriterionEditor памятка** — show только если value_type выбран (после mount, не на пустой форме). useEffect или useMemo.
5. **Footer ссылки** — могут быть rel="nofollow" или без. Лучше без — это полезные ссылки для поисковиков.

---

## Формат отчёта

```
Отчёт — Wave 8 frontend (AC-Федя)

Ветка: ac-rating/wave8-frontend (rebased на origin/main)
Коммиты: <git log --oneline main..HEAD>

Что сделано:
- ✅ Tab switcher на /quiet, /price/*, /preset/*
- ✅ Ad row UI: убран индекс, плашка справа
- ✅ DetailMedia: убран badge «ФОТО ГАЛЕРЕЯ», стрелки видимы в dark
- ✅ Pros/Cons dark mode читаемо
- ✅ CriterionEditor: памятка для categorical/custom_scale
- ✅ Photo критерия в /methodology/ публичной
- ✅ Footer SEO ссылки (4 файла)

Прогон:
- npx tsc --noEmit: ok
- npm test: <X> passed

Скриншоты: ...

Ключевые файлы:
- frontend/app/(hvac-info)/rating-split-system/_components/RatingTabs.tsx
- frontend/app/(hvac-info)/rating-split-system/_components/ListItem.tsx
- frontend/app/(hvac-info)/rating-split-system/_components/DetailMedia.tsx
- frontend/app/(hvac-info)/rating-split-system/_components/DetailEditorial.tsx
- frontend/app/(hvac-info)/rating-split-system/methodology/page.tsx
- frontend/app/(hvac-info)/_components/Footer.tsx
- frontend/components/hvac/pages/ACCriterionEditor.tsx
- frontend/app/(hvac-info)/quiet/page.tsx
- frontend/app/(hvac-info)/price/[slug]/page.tsx
- frontend/app/(hvac-info)/rating-split-system/preset/[slug]/page.tsx
```
