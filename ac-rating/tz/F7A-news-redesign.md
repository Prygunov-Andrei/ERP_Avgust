# ТЗ Фазы Ф7A — Редизайн HVAC-новостей + унификация header/tokens

**Фаза:** Ф7A (frontend, корневая `/` = лента + `/news/[id]/` = деталь)
**Ветка:** `ac-rating/f7a-news-redesign` (от `main`)
**Зависит от:** M5 (параллельно; T1 не блокируется, T2-T5 используют M5-поля с graceful fallback)
**Оценка:** 3-4 дня

## Контекст

Ф6A-C закрыли `/ratings/*` с editorial-дизайном (teal accent, Source Serif 4 + Inter +
JetBrains Mono, scoped tokens `.rating-scope`). Ф7A — то же самое для `/news/`, плюс
унификация header и scope под единый `.hvac-info-scope`, плюс cross-link с AC Rating
через «Упомянутая модель» card.

**Сейчас (до Ф7A):**
- Корневая `frontend/app/page.tsx` — список новостей через `PublicLayout` + `LoadMoreNews` из `components/public/`
- `frontend/app/news/[id]/page.tsx` — деталь через `getNewsById`, использует `PublicLayout`
- `frontend/app/ratings/_components/RatingHeader.tsx` — свой header только для `/ratings/*`
- `PublicLayout` и `RatingHeader` **дублируют** навигацию по-разному
- `.rating-scope` классом применён только к `/ratings/`

**Цель:** единый визуальный язык для двух разделов (news + rating) как для одного сайта hvac-info.com.

**Дизайн в вайрфреймах:**
- `wf-screens.jsx:1014-1050` — **NewsListA** (корневая `/` — hero 2col + feed 3col grid)
- `wf-screens.jsx:1052-1108` — **NewsDetailA** (deep editorial: breadcrumb + eyebrow + H1 serif 40px + author + hero image + long-form + pull-quote + «Упомянутая модель» card + пред/след нав)
- `wf-screens.jsx:1112-1167` — **MobileNewsList** (compact feed + filter chips)
- `wf-screens.jsx:1169+` — **MobileNewsDetail**

**M5 добавит (параллельно):**
- `category`/`category_display`, `lede`, `reading_time_minutes`, `editorial_author`, `mentioned_ac_models` на NewsPost
- `news_mentions` (до 5 lite-postов) в ACModelDetailSerializer

## Ключевые решения

1. **HvacInfoHeader** — общий компонент для `/` + `/news/*` + `/ratings/*`. Active-пункт вычисляется из `usePathname()`. Переносится из `frontend/app/ratings/_components/RatingHeader.tsx` в `frontend/components/hvac-info/HvacInfoHeader.tsx` (новый location вне ratings-scope, чтобы обе страницы-use-case'а брали его отсюда).

2. **Scope tokens:** **переименовать CSS-класс** `.rating-scope` → `.hvac-info-scope`. **Токены оставить с префиксом `--rt-*`** (минимальный diff; 50+ файлов используют `hsl(var(--rt-accent))` — переименовывать не оправдано). Применить `.hvac-info-scope` к корневому layout HVAC-портала (корневая `/` + `/news/*` + `/ratings/*`) один раз — через `frontend/app/layout.tsx` (root)? **Нет, корневой layout НЕ трогать** (там shadcn tokens для ERP). Вместо этого:
   - Создать `frontend/app/(hvac-info)/layout.tsx` — **route group** `(hvac-info)` (скобки в имени = не добавляют к URL). Поместить туда `HvacInfoLayout` с `.hvac-info-scope` + next/font + tokens.
   - Переместить `app/page.tsx` → `app/(hvac-info)/page.tsx`
   - Переместить `app/news/` → `app/(hvac-info)/news/`
   - Переместить `app/ratings/` → `app/(hvac-info)/ratings/`
   - `.rating-scope` alias-класс оставить на короткое время (для смягчения diff), постепенно удалить в Ф7B.

   Это **big refactor**, но **чистое** решение: URL'ы не меняются (`/`, `/news/[id]/`, `/ratings/...`), а layout переиспользуется.

3. **PublicLayout (текущий)** — после мержа Ф7A **удаляется** из новостных страниц. Возможно, `PublicLayout` ещё используется на `/manufacturers/`, `/brands/`, `/resources/` — **их пока не трогаем** (не в скоупе Ф7). Они остаются на старом PublicLayout.

4. **Dynamic → Static/ISR:** `app/page.tsx` сейчас `export const dynamic = "force-dynamic"`. После Ф7A — `export const revalidate = 300` (5 минут, лента обновляется часто). Детальные — ISR 3600s.

5. **Hero image для новости** — берётся из `news_post.media[0]` (первое image-media). Если нет — placeholder с stripe-pattern (как в рейтинге для пустых photos).

6. **Category filter — client-side**. Лента при первом рендере приходит полная (или paginated если 50+); chip-filter фильтрует `news.filter(n => n.category === active)` через URL-state `?category=business`.

7. **Предыдущая/Следующая** — вычисляются клиентски из полного списка новостей (в детали делаем отдельный fetch полного list + findIndex текущего + брать `[idx-1]` и `[idx+1]`). Не требует backend-изменений.

8. **«Упомянутая модель» card** — первая из `mentioned_ac_models[]` (M5). Если список >1 — показываем до 3 карточек компактно. Если пусто — секция не рендерится.

9. **«Упоминания в прессе» на AC-модели** — отдельный новый блок `DetailNewsMentions` в `/ratings/[slug]/`, вставляется **после DetailCriteria, перед DetailIndexViz** (или после Related в Ф6B — решай при интеграции). Использует `detail.news_mentions` из M5.

## Задачи

### T1. Layout refactor: route group + HvacInfoHeader (0.6 дня)

**T1.1. Создать `frontend/components/hvac-info/HvacInfoHeader.tsx`** (копия RatingHeader + улучшения):

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Новости', pathPrefix: '/news', homeAlso: true /* / тоже active */ },
  { label: 'Рейтинг', pathPrefix: '/ratings' },
  { label: 'ISmeta', pathPrefix: '/smeta' },
  { label: 'Мешок Монтажников', muted: true },
  { label: 'Анализ проектов', muted: true },
  { label: 'Франшиза', muted: true },
  { label: 'Ассоциация', muted: true },
  { label: 'Стандарт монтажа', muted: true },
];

export default function HvacInfoHeader() {
  const path = usePathname();
  // active:
  //   - «Новости» активна на `/` или `/news/*`
  //   - «Рейтинг» активна на `/ratings/*`
  //   - etc
  const isActive = (it) =>
    'muted' in it ? false
      : (it.homeAlso && path === '/') || path.startsWith(it.pathPrefix);
  // ... остальное как в RatingHeader (logo + nav + actions + mobile burger)
}
```

Перенести CSS + logo rendering из `RatingHeader` 1-в-1, добавить `usePathname` для active-state.

**T1.2. Создать route group `frontend/app/(hvac-info)/layout.tsx`:**

```tsx
import type { Metadata } from 'next';
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google';
import '../ratings/_styles/tokens.css';  // пока остаётся, перенесём в Ф7B

const inter = Inter({ subsets: ['latin','cyrillic'], variable: '--rt-font-sans-loaded' });
const serif = Source_Serif_4({ subsets: ['latin','cyrillic'], variable: '--rt-font-serif-loaded' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--rt-font-mono-loaded' });

export const metadata: Metadata = {
  title: 'HVAC Info — независимый портал о кондиционерах',
  description: 'Рейтинг кондиционеров, новости, методика, франшиза Август-климат',
};

export default function HvacInfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`hvac-info-scope rating-scope ${inter.variable} ${serif.variable} ${mono.variable}`}
      style={{
        background: 'hsl(var(--rt-paper))',
        color: 'hsl(var(--rt-ink))',
        fontFamily: 'var(--rt-font-sans), Inter, system-ui, sans-serif',
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  );
}
```

**Оба класса `hvac-info-scope rating-scope` на div** — чтобы старые компоненты `/ratings/*`
не сломались (они рассчитывают на родителя с `.rating-scope`). Добавить в
`frontend/app/ratings/_styles/tokens.css` дублирующий селектор:

```css
.hvac-info-scope {
  /* те же токены что и .rating-scope — CSS-copy */
  --rt-ink: 0 0% 8%;
  /* ... */
}
.dark .hvac-info-scope {
  /* ... */
}
```

Или проще — `.rating-scope, .hvac-info-scope { ... }` в одном селекторе.

**T1.3. Переместить страницы в route group:**

```bash
# bash-pseudocode — НЕ запускать буквально, сделай как подсказывает git
git mv frontend/app/page.tsx frontend/app/\(hvac-info\)/page.tsx
git mv frontend/app/news frontend/app/\(hvac-info\)/news
git mv frontend/app/ratings frontend/app/\(hvac-info\)/ratings
```

**T1.4. Удалить `RatingHeader` import** из всех `/ratings/*/page.tsx` — вместо него импортировать `HvacInfoHeader` из `@/components/hvac-info/HvacInfoHeader`. Сам файл `RatingHeader.tsx` **не удалять пока** — Ф7B уберёт, когда точно увидим что всё работает.

Но в `HvacInfoLayout` уже есть header? **Нет, layout не содержит header** — каждая page-route сама решает, рендерить ли header (чтобы детальные могли иметь custom-header). Так что:
- `(hvac-info)/page.tsx` (новости лента) — рендерит `<HvacInfoHeader/>`
- `(hvac-info)/news/[id]/page.tsx` — рендерит `<HvacInfoHeader/>`
- `(hvac-info)/ratings/**/page.tsx` — **уже имеют `<RatingHeader/>`** (Ф6A), заменить на `<HvacInfoHeader/>`.

**T1.5. Проверить: старый `PublicLayout`** в `components/public/PublicLayout.tsx` — **не удалять**, остаётся для других routes (`/manufacturers/`, `/brands/`, `/resources/`, etc). Ф7A его НЕ трогает для этих разделов.

### T2. NewsListPage — корневая `/` (0.5 дня)

Файл: `frontend/app/(hvac-info)/page.tsx`.

Заменить текущую `HomePage` на новую:

```tsx
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import NewsFeedHero from './_components/NewsFeedHero';
import NewsCategoryFilter from './_components/NewsCategoryFilter';
import NewsFeedList from './_components/NewsFeedList';
import { getNews } from '@/lib/hvac-api';

export const revalidate = 300;  // 5 минут

export default async function NewsFeedPage() {
  const firstPage = await getNews(1);
  const items = firstPage.results;  // 20-30 самых свежих
  return (
    <>
      <HvacInfoHeader />
      <NewsFeedHero items={items} />
      <NewsCategoryFilter />
      <NewsFeedList items={items} />
    </>
  );
}
```

**`NewsFeedHero.tsx`** (server):
- Padding 28×40
- Eyebrow «Новости отрасли»
- H1 serif 30px «Сегодня, {formatDate(items[0]?.pub_date)}»
- Grid `1.5fr 1fr`:
  - Слева: hero-card `items[0]` (большой):
    - `items[0].media[0]` (первое image) или placeholder, h=240
    - Pill tone="accent" `{items[0].category_display || 'Новости'} · {pubDate}`
    - H2 serif 26px `{items[0].title}` (balance text-wrap)
    - Description `items[0].lede || truncate(items[0].body, 200)` ink-60 max-w 520
  - Справа: «Рядом» feed `items[1..4]`:
    - Eyebrow «Рядом»
    - Для каждого: `{date} · {category_display}` mono 10 + title 14px
    - Click → `<Link href={`/news/${item.id}`}>`

**`NewsCategoryFilter.tsx`** (client — URL-state):
- Padding 0×40, flex gap 6
- Chips: `[Все] [Деловые] [Индустрия] [Рынок] [Регулирование] [Обзор] [Гайд] [Бренды]`
- Active-chip: accent-bg + ink text + weight 600
- Click → `router.replace('/?category=...', { scroll: false })`

**`NewsFeedList.tsx`** (client — для фильтрации + load more):
- Skip первые 4 (они в hero), показывать остальные grid 3-col
- Каждая карточка: border subtle, radius 4, padding 16. Box placeholder h=110 → потом `media[0]` img, eyebrow `{date} · {category}`, title 13px weight 500 lh 1.3
- Load-more кнопка внизу — вызывает `getNews(page+1)` client-side, концатенит в state, скрывается когда `!hasNext`
- Фильтр: `items.filter(n => category==='all' || n.category === category)` через URL-search

### T3. NewsDetailPage — `/news/[id]/` (0.8 дня)

Файл: `frontend/app/(hvac-info)/news/[id]/page.tsx`.

Полностью переписать:

```tsx
import { notFound } from 'next/navigation';
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import NewsBreadcrumb from './_components/NewsBreadcrumb';
import NewsArticleHero from './_components/NewsArticleHero';
import NewsArticleBody from './_components/NewsArticleBody';
import NewsMentionedModelCard from './_components/NewsMentionedModelCard';
import NewsPrevNextNav from './_components/NewsPrevNextNav';
import { getNewsById, getAllNews } from '@/lib/hvac-api';

export const revalidate = 3600;

export async function generateStaticParams() {
  // SSG для самых свежих 50 новостей
  try {
    const all = await getAllNews();
    return all.slice(0, 50).map(n => ({ id: String(n.id) }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }): Promise<Metadata> {
  const { id } = await params;
  try {
    const news = await getNewsById(Number(id));
    return {
      title: `${news.title} | HVAC Info`,
      description: news.lede || news.body.slice(0, 160),
      openGraph: {
        images: news.media?.[0]?.file ? [news.media[0].file] : [],
      },
    };
  } catch {
    return { title: 'Новость не найдена' };
  }
}

export default async function NewsDetailPage({ params }) {
  const { id } = await params;
  let news, allNews;
  try {
    [news, allNews] = await Promise.all([
      getNewsById(Number(id)),
      getAllNews(),
    ]);
  } catch {
    notFound();
  }
  const idx = allNews.findIndex(n => n.id === news.id);
  const prev = idx > 0 ? allNews[idx - 1] : null;
  const next = idx < allNews.length - 1 ? allNews[idx + 1] : null;

  return (
    <>
      <HvacInfoHeader />
      <article style={{ maxWidth: 760, margin: '0 auto', padding: '20px 40px 28px' }}>
        <NewsBreadcrumb category={news.category_display} />
        <NewsArticleHero news={news} />
        <NewsArticleBody body={news.body} />
        {news.mentioned_ac_models?.length > 0 && (
          <NewsMentionedModelCard models={news.mentioned_ac_models} />
        )}
        <NewsPrevNextNav prev={prev} next={next} />
        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <Link href="/">← Вернуться ко всем новостям</Link>
        </div>
      </article>
    </>
  );
}
```

**`NewsBreadcrumb.tsx`** (server):
- Padding-bottom 18, border-bottom subtle
- `← Все новости · Главная / Новости / {category_display}`
- Mono-текст разной интенсивности (accent/ink-40/ink-60), chevron-separators

**`NewsArticleHero.tsx`** (server):
- Eyebrow `{category_display} · {formatDate(pub_date)} · {reading_time_minutes} мин чтения`
- H1 serif 40px, letter-spacing -0.8
- Lede — serif 15px, line-height 1.55, ink-60 (из `news.lede` или `news.body.slice(0, 200)` как fallback)
- **Author row** (если `editorial_author`):
  - `<img src={avatar_url}>` 28×28 circle, fallback — initial letter в `rt-chip` bg
  - `{name}` weight 600 11px + `{role}` ink-40 10px
  - Кнопки `[Поделиться] [Сохранить]` — ghost Pill, placeholder без функционала
- Hero-image `news.media[0]` (если есть), aspect ~16:9 h=340, под ней — caption «Фото: {source_url?.hostname}» italic

**`NewsArticleBody.tsx`** (server):
- Plain markdown rendering. Используй lightweight markdown-parser — например `marked` или `remark-html`. **ВНИМАНИЕ:** проверь, установлен ли уже в package.json. Если **нет**:
  - Для Ф7A используй **простой `body.split('\n\n')` → `<p>`** без markdown. Безопасно и работает для plain-text новостей.
  - Если видно что body реально содержит markdown (`##` заголовки, `**bold**`, lists) — опционально установи `marked` в отдельный коммит, мотивируй в отчёте.
- Line-height 1.7, font-size 14px, первый параграф может быть первой буквицей drop-cap (опционально).
- Pull-quotes: если в body есть строки начинающиеся с `> ` — рендерить как `<blockquote>` с border-left accent 3px, italic serif 15px, padding 20×24, bg `rt-alt`.

### T4. NewsMentionedModelCard + NewsPrevNextNav (0.2 дня)

**`NewsMentionedModelCard.tsx`** (server):

Если `models.length === 0` — не рендерится. Если 1 — одна крупная карточка. Если >1 — до 3 компактных.

Одна крупная (как в дизайне `wf-screens.jsx:1086-1090`):
```tsx
<div style={{
  marginTop: 28, padding: 18,
  border: '1px solid hsl(var(--rt-border-subtle))',
  borderRadius: 6,
  display: 'flex', gap: 14, alignItems: 'center'
}}>
  <BrandLogo src={model.brand_logo || ''} name={model.brand || ''} size={80} />
  <div>
    <T size={10} color="var(--rt-ink-40)" mono>Упомянутая модель</T>
    <T size={14} weight={600}>{model.brand} {model.inner_unit}</T>
    <T size={11} color="var(--rt-ink-60)">
      Индекс {model.total_index?.toFixed(1)} · {formatPrice(model.price)}
    </T>
  </div>
  <Link href={`/ratings/${model.slug}/`} className="btn btn-ghost">Открыть →</Link>
</div>
```

Несколько — grid 3 колонки mini-cards.

**`NewsPrevNextNav.tsx`** (server):

- Grid 2 колонки, padding-top 22, border-top ink-15
- Left card (если prev): mono eyebrow «← Предыдущая» + title 13px line-height 1.35
- Right card (если next): mono «Следующая →» + title. Align right.
- Click → `<Link href={`/news/${prev.id}`}>`
- Empty states: если prev=null — показываем placeholder-карточку «Это первая новость» (ink-40).

### T5. DetailNewsMentions на AC-модели (0.3 дня)

**`frontend/app/(hvac-info)/ratings/_components/DetailNewsMentions.tsx`** (server):

Используй `detail.news_mentions` (из M5.6).

```tsx
export default function DetailNewsMentions({ mentions }: { mentions: NewsMention[] }) {
  if (!mentions || mentions.length === 0) return null;
  return (
    <section style={{ padding: '40px 40px', borderTop: '1px solid hsl(var(--rt-border-subtle))' }}>
      <Eyebrow>Упоминания в прессе</Eyebrow>
      <H size={24} serif style={{ marginTop: 6, marginBottom: 20 }}>
        {mentions.length} {plural(mentions.length, 'новость/новости/новостей')} о модели
      </H>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {mentions.map(m => (
          <Link key={m.id} href={`/news/${m.id}`} style={{ display: 'block', padding: 16, border: '1px solid hsl(var(--rt-border-subtle))', borderRadius: 4 }}>
            <T size={10} color="var(--rt-ink-40)" mono>
              {m.category_display} · {formatDate(m.pub_date)} · {m.reading_time_minutes} мин
            </T>
            <T size={14} weight={500} style={{ marginTop: 6 }}>{m.title}</T>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

Импорт в `frontend/app/(hvac-info)/ratings/[slug]/page.tsx`, добавить секцию **после DetailCriteria, перед DetailIndexViz** (решение по порядку на ревью).

Добавь в `/ratings/[slug]/page.tsx` активный якорь `mentions` в `DetailAnchorNav` (новый 6-й якорь, в Ф7A можно пока включить как active, т.к. M5 к этому моменту уже в main).

### T6. MobileNewsList + MobileNewsDetail (0.5 дня)

Делаем через Tailwind-обёртки (`lg:hidden` / `hidden lg:block`) либо отдельные components + `@media` в inline-style.

**Mobile list (на `/`):**
- `NewsFeedHeroMobile` — compact (h=200 image, H 20px serif)
- Horizontal filter-chips (overflow-x auto)
- Compact feed rows: 72×72 thumb + eyebrow date + title (13px)

**Mobile detail (на `/news/[id]/`):**
- Stacked breadcrumb
- H1 24px serif
- Author row compact
- Hero 16:9
- Body unchanged (reflows)
- Mentioned card: стек вертикально
- Prev/Next — один столбец stacked

### T7. Тесты (0.2 дня)

**`frontend/app/(hvac-info)/news/_components/newsHelpers.test.ts`:**
- `formatDate` (из common?) — если ещё нет, создай в `detailHelpers` или отдельном
- `prevNextFromIndex(all, currentIdx)` — edge cases 0, length-1, middle

**`frontend/app/(hvac-info)/news/[id]/_components/NewsArticleBody.test.tsx`:**
- Плейн текст разбивается на параграфы
- `> ` рендерится как blockquote

**`frontend/components/hvac-info/HvacInfoHeader.test.tsx`:**
- Active-state: `/` → «Новости» active. `/news/123` → «Новости» active. `/ratings/abc` → «Рейтинг» active.

**Ожидаемо +8-10 тестов, ~285 + 10 = ~295.**

### T8. Удаление ComingSoon-like legacy (0.1 дня)

Если после Ф7A остаётся неиспользуемый `RatingHeader.tsx` — удалить. Поиск:
`grep -r "RatingHeader" frontend/` — должен быть пусто.

Если `frontend/components/public/PublicLayout.tsx` используется только для /manufacturers/, /brands/, /resources/ — **оставить** (не Ф7A scope).

## Приёмочные критерии

- [ ] `npx tsc --noEmit` — 0 ошибок
- [ ] `npm test -- --run` — все passing (включая +10 новых)
- [ ] `BACKEND_API_URL=http://localhost:8000 npm run build` — успешно:
  - [ ] `/` — ISR 5 min (○ или ● в build output)
  - [ ] `/news/[id]` — SSG для 50 самых свежих + ISR 1h
  - [ ] `/ratings/*` — без изменений после перемещения в route group
- [ ] `npm run dev`:
  - [ ] `/` — новый дизайн ленты (hero + feed + filter chips)
  - [ ] `/news/123` — editorial-layout с (если M5 в main) author + mentioned-card + prev/next
  - [ ] `/ratings/<slug>/` — всё работает как раньше + новая секция «Упоминания в прессе» (если есть mentions)
  - [ ] HvacInfoHeader: «Новости» active на `/`, «Рейтинг» active на `/ratings/*`, «ISmeta» active на `/smeta/*`
  - [ ] Mobile 390px — все адаптируется
- [ ] **Graceful fallback** если M5 не смержен: category_display='', lede='', editorial_author=null, mentioned_ac_models=[] — **страницы не падают**, а показывают placeholder'ы или скрывают блоки.
- [ ] `PublicLayout` не используется в `/` и `/news/*`
- [ ] Route group `(hvac-info)` работает корректно, URL не меняются
- [ ] Dark mode не ломается

## Ограничения

- **НЕ трогать** `frontend/app/layout.tsx` (корневой) — там shadcn tokens для ERP.
- **НЕ удалять** `PublicLayout` — остаётся для `/manufacturers/`, `/brands/`, `/resources/`.
- **НЕ менять** logic `LoadMoreNews` если он переиспользуется — переноси целиком или создавай новый `NewsFeedList` без зависимости от старого.
- **НЕ добавлять** новые publish'a на сайт (SEO sitemap, RSS) — существующие должны работать после перемещения.
- **НЕ реализовывать** markdown-рендер body как priority если body plain-text — оставь `split('\n\n') → <p>`.
- **НЕ реализовывать** Share/Save-кнопки функционально — placeholder без клика.
- Conventional Commits, по коммиту на подзадачу (T1-T8). Trailer `Co-authored-by: AC-Федя <ac-fedya@erp-avgust>`.

## Формат отчёта

`ac-rating/reports/f7a-news-redesign.md`:
1. Ветка + коммиты
2. Что сделано (T1-T8)
3. Проверки: tsc, tests, build, dev smoke со screenshots:
   - `/` desktop (лента с hero + feed)
   - `/news/123` desktop (editorial + mentioned-card)
   - `/ratings/<slug>` с новой секцией «Упоминания в прессе»
   - `/` mobile
   - `/news/123` mobile
4. Сюрпризы / риски (например: PublicLayout кого-то сломал / shared-css conflicts / SSR hydration mismatch на HvacInfoHeader)
5. Ключевые файлы
6. Что в Ф7B (если планируется): удалить `.rating-scope` alias и `RatingHeader.tsx`, refactor tokens на `--hvac-*`

## Подсказки от техлида

- **Route group `(hvac-info)`** — Next.js feature: папки в скобках не влияют на URL, только на layout inheritance. Docs: https://nextjs.org/docs/app/building-your-application/routing/route-groups
- **Git mv перед refactor:** делай `git mv` **отдельным коммитом** без содержательных правок. Потом — правки импортов отдельным коммитом. Это облегчает ревью.
- **При перемещении файлов в route group** — все **импорты относительные (`../_components/...`)** могут сломаться. Лучше использовать absolute (`@/app/...`) где возможно, но `@/app/(hvac-info)/...` — странный путь. Используй аккуратные relative-paths.
- **HvacInfoHeader использует `usePathname()`** — это client-only hook, компонент `'use client'`. Layout может быть server, header — client-island.
- **Active-state для `/`**: в `isActive` добавь condition `item.homeAlso && path === '/'` для «Новости».
- **`getAllNews()`** fetch'ит все страницы в цикле — может быть 100+ новостей. Для prev/next работает быстро, но для SSG 50 — `generateStaticParams` использует то же. ISR 1h смягчит. Если окажется медленно — добавь `getNewsIdsOnly()` который отдаёт только `[{id,pub_date}]`.
- **PublicLayout shadow:** сейчас его header — shadcn-based, с собственными цветами. При удалении из `/` и `/news/*` нужно убедиться что корневой layout.tsx **не** применяет shadcn-themes на эти pages (он и не должен, т.к. мы в route group). Проверь `index.css` / `globals.css` — `.hvac-info-scope` ДОЛЖЕН изолировать стили.
- **Token naming:** **НЕ ПЕРЕИМЕНОВЫВАЙ `--rt-*` → `--hvac-*` в этой фазе**. 50+ файлов в `/ratings/`. Massive diff, высокий риск регрессий. Оставь alias классом, не токенами.
- **«Поделиться/Сохранить» в article hero** — в дизайне Pill ghost. Сейчас placeholder-buttons без логики. Если хочется легко добавить — `navigator.share()` для share, localStorage для save. Не входит в приёмку.
- **Pull-quote в body:** плохо определять по `> ` в plain text. Если body markdown — парсер сам. Если plain — оставь без pull-quotes, визуально будет просто параграф italic.
- **SEO meta:** старый `HomePage` был `dynamic = "force-dynamic"`. Новый — ISR 5min. Это **улучшение** для SEO (sitemap стабильнее). Но если у админа частые правки — 5 min refresh устроит.

## Запуск

```bash
cd /Users/andrei_prygunov/obsidian/avgust/ERP_Avgust
git fetch origin
git worktree add -b ac-rating/f7a-news-redesign ../ERP_Avgust_ac_fedya_f7a origin/main
cd ../ERP_Avgust_ac_fedya_f7a/frontend && npm install
# Перезапустись из нового CWD — claude. Бэкенд на localhost:8000.
# Один коммит на задачу. Перед push — rebase.
# M5 параллельно у Пети: если ещё не смержен — graceful fallback на пустые поля (по типам nullable/empty).
```
