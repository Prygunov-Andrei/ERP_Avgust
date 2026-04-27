# TASK — Wave 9 frontend — динамические категории + 2 news-бага

## 1. Динамические категории news

### Контекст
Wave 9 backend смержен. `NewsPost.category` теперь принимает любой slug из NewsCategory. Frontend должен:
- В NewsEditor: Select заполняется через `newsCategoriesService.getNewsCategories()` (API).
- В типах: `HvacNewsCategory` тип → `string` (или просто `string` без alias).

### Файлы

**`frontend/lib/api/types/hvac.ts`:**

Сейчас:
```ts
export type HvacNewsCategory =
  | 'business' | 'industry' | 'market' | 'regulation'
  | 'review' | 'guide' | 'brands' | 'other';
```

Стало:
```ts
/**
 * Slug категории новости — свободная строка из NewsCategory (динамика).
 * Раньше было hardcoded enum (8 значений), снято в Wave 9 backend (миграция
 * news/0031_alter_newspost_category.py — choices убраны).
 *
 * Старые 8 slug'ов остаются: business, industry, market, regulation, review,
 * guide, brands, other — они в БД через NewsCategory с теми же slug'ами.
 *
 * Для отображения категории — используй `news.category_object?.name` через FK,
 * не `category_display` (старый сериализатор для legacy enum).
 */
export type HvacNewsCategory = string;
```

(Тип становится псевдонимом string. Легче чем вырезать тип всюду.)

**`frontend/components/hvac/pages/NewsEditor.tsx`:**

1. Найти `<Select value={category}>` (или подобное) — заменить hardcoded `<SelectItem value="business">Деловые</SelectItem>...` на динамический список.

2. Loadrequiring categories on mount:
```tsx
const [categories, setCategories] = useState<HvacNewsCategoryItem[]>([]);

useEffect(() => {
  newsCategoriesService.getNewsCategories()
    .then(setCategories)
    .catch(() => setCategories([]));
}, []);

// В JSX:
<Select value={category} onValueChange={(v) => setCategory(v)}>
  <SelectTrigger>
    <SelectValue placeholder="— Выберите категорию —" />
  </SelectTrigger>
  <SelectContent>
    {categories.filter(c => c.is_active).map(c => (
      <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
    ))}
    {/* fallback для legacy 'other' если в API нет */}
    {categories.length === 0 && <SelectItem value="other">Прочее</SelectItem>}
  </SelectContent>
</Select>
```

(Сверь точное расположение Select в NewsEditor — может быть в подкомпоненте news-editor/.)

3. Убрать TypeScript cast `as HvacNewsCategory` (теперь это просто string).

**Проверка:** после фикса в NewsEditor можно выбрать любую категорию из списка NewsCategory (включая новые), сохранение проходит. Backend сделает sync `category_ref`.

---

## 2. Баг A: NewsEditor RichTextEditor dark mode нечитаем

### Контекст
В `frontend/components/hvac/components/RichTextEditor.tsx` строка ~65:
```ts
class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
```

В Tailwind `prose` ставит typography defaults (включая чёрный текст). В dark theme текст остаётся тёмным.

### Фикс

```ts
class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[400px] p-4',
```

`dark:prose-invert` заменит цвет на белый/светлый в `.dark`-контексте. Это стандартный Tailwind Typography pattern.

### Проверка
- Открой `/erp/hvac/news/edit/<id>/` в dark mode — текст в редакторе должен быть светлым.
- Light mode — без изменений.

---

## 3. Баг B: дубль hero/body на странице новости

### Контекст
Файл: `frontend/app/(hvac-info)/news/[id]/page.tsx:118` рендерит:
```tsx
<NewsArticleHero news={news} />
<NewsArticleBody body={news.body || ''} />
```

`NewsArticleHero` использует helpers:
- `getNewsHeroImage(news)` — берёт первое `<img>` из `body` если у `news.media` нет изображения.
- `getNewsLede(news)` — берёт первые 200 символов `body` (без HTML) если `lede` пустое.

`NewsArticleBody` рендерит **полный** body (с теми же `<img>` и текстом).

Результат: hero показывает первое фото + первый абзац, body показывает их снова + продолжение.

### Фикс

Добавить helper в `frontend/app/(hvac-info)/_components/newsHelpers.ts`:

```ts
/**
 * Возвращает body новости с отрезанной первой картинкой и/или первым параграфом
 * — если они уже использованы в hero (как hero image или lede).
 *
 * Используется в NewsArticleBody чтобы избежать дублирования с NewsArticleHero.
 */
export function getNewsBodyWithoutHero(news: NewsItem): string {
  let body = news.body || '';
  if (!body) return '';
  
  // Если hero image взят из body (а не из news.media) — отрезать первое <img>.
  const heroFromMedia = news.media?.find(
    (m) => (m.media_type ?? 'image') === 'image'
  )?.file;
  if (!heroFromMedia) {
    body = body.replace(/^\s*<img[^>]*>\s*/i, '');
  }
  
  // Если lede пустое (значит helper подставил начало body) — отрезать первый <p>.
  if (!news.lede || !news.lede.trim()) {
    // Убираем пустые <p></p> в начале (от парсинга tinymce/tiptap)
    body = body.replace(/^\s*(<p>\s*<\/p>\s*)+/gi, '');
    // Убираем первый абзац с текстом (или несколько если короткие — но здесь
    // консервативно: только первый <p>...</p> с непустым содержимым)
    body = body.replace(/^\s*<p>[\s\S]*?<\/p>\s*/i, '');
  }
  
  return body.trim();
}
```

Затем в `frontend/app/(hvac-info)/news/[id]/page.tsx`:
```tsx
import { getNewsBodyWithoutHero } from '../../_components/newsHelpers';
// ...
<NewsArticleBody body={getNewsBodyWithoutHero(news)} />
```

### Тесты

В `frontend/app/(hvac-info)/_components/newsHelpers.test.ts` (или новый файл):

```ts
describe('getNewsBodyWithoutHero', () => {
  it('отрезает первое <img> если hero взят из body', () => {
    const news = {
      media: [],
      lede: 'Текст лида',
      body: '<img src="/x.jpg"><p>Текст статьи</p>',
    } as NewsItem;
    expect(getNewsBodyWithoutHero(news)).toBe('<p>Текст статьи</p>');
  });
  
  it('сохраняет <img> если hero взят из media', () => {
    const news = {
      media: [{ file: '/hero.jpg', media_type: 'image' }],
      lede: 'Текст лида',
      body: '<img src="/x.jpg"><p>Текст статьи</p>',
    } as NewsItem;
    expect(getNewsBodyWithoutHero(news)).toContain('<img');
  });
  
  it('отрезает первый <p> если lede пустое', () => {
    const news = {
      media: [],
      lede: '',
      body: '<img src="/x.jpg"><p></p><p>Первый абзац (lede).</p><p>Второй абзац.</p>',
    } as NewsItem;
    const result = getNewsBodyWithoutHero(news);
    expect(result).not.toContain('Первый абзац');
    expect(result).toContain('Второй абзац');
  });
  
  it('не трогает body если lede заполнен', () => {
    const news = {
      media: [{ file: '/hero.jpg', media_type: 'image' }],
      lede: 'Свой осмысленный лид',
      body: '<p>Первый абзац.</p><p>Второй.</p>',
    } as NewsItem;
    const result = getNewsBodyWithoutHero(news);
    expect(result).toContain('Первый абзац');
  });
});
```

### Проверка
- Открой страницу новости 2719 (https://hvac-info.com/news/2719) в dev — фото и lede не дублируются.
- На новостях с заполненным `lede` и `media` — body показывается без изменений.

---

## 4. Прогон

```bash
cd frontend
npx tsc --noEmit
npm test -- --run                              # все зелёные
npm test -- --run newsHelpers                  # новые тесты
```

---

## 5. Что НЕ делаем

- ❌ Не трогаем backend — Wave 9 backend смержен.
- ❌ Не делаем разделение body на абзацы / красивую обработку картинок — только убрать дублирование.
- ❌ Не трогаем discovery-сервис (импорт новостей) — он создаёт записи как раньше.

---

## 6. Известные нюансы

1. **`dark:prose-invert`** — стандартный Tailwind Typography классificator. Если в проекте `@tailwindcss/typography` плагин не подключён — `prose` уже работает, значит подключён. Проверь `tailwind.config.{js,ts}` если сомневаешься.
2. **`category_object`** в API ответе — это nested NewsCategory от FK. После Wave 9 backend он заполнен для всех новостей с corrected category_ref (Андрей сделает re-save через bulk-update если нужно).
3. **`HvacNewsCategory = string`** — это псевдоним string. Все существующие `as HvacNewsCategory` cast'ы продолжают работать (string кастуется в string).
4. **`getCategoryLabel`** — оставить как есть (использует category_display fallback). Но в новых местах предпочтительно `news.category_object?.name`.

---

## 7. Формат отчёта

```
Отчёт — Wave 9 frontend (AC-Федя)

Ветка: ac-rating/wave9-frontend (rebased на origin/main)
Коммиты: <git log --oneline main..HEAD>

Что сделано:
- ✅ Динамические категории: HvacNewsCategory → string,
  NewsEditor Select из API getNewsCategories()
- ✅ RichTextEditor: dark:prose-invert (текст читаем в dark mode)
- ✅ getNewsBodyWithoutHero helper + использован в page.tsx
- ✅ <N> тестов

Прогон:
- npx tsc --noEmit: ok
- npm test: <X> passed

Известные риски: ...

Ключевые файлы:
- frontend/lib/api/types/hvac.ts (HvacNewsCategory → string)
- frontend/components/hvac/pages/NewsEditor.tsx (Select из API)
- frontend/components/hvac/components/RichTextEditor.tsx (+dark:prose-invert)
- frontend/app/(hvac-info)/_components/newsHelpers.ts (getNewsBodyWithoutHero)
- frontend/app/(hvac-info)/news/[id]/page.tsx (use getNewsBodyWithoutHero)
- frontend/app/(hvac-info)/_components/newsHelpers.test.ts (тесты)
```
