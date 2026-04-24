import { Suspense } from 'react';
import { unstable_noStore as noStore } from 'next/cache';
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import { getNews } from '@/lib/hvac-api';
import NewsFeedHero from './_components/NewsFeedHero';
import NewsCategoryFilter from './_components/NewsCategoryFilter';
import NewsFeedList from './_components/NewsFeedList';
import NewsViewSwitcher from './_components/NewsViewSwitcher';
import SectionFooter from './_components/SectionFooter';
import { loadFirstPage } from './loadFirstPage';

export const revalidate = 300;

export default async function NewsFeedPage() {
  const { page: firstPage, empty } = await loadFirstPage(() => getNews(1));
  const items = firstPage.results ?? [];

  // Критично: если после ретраев пусто — не даём Next.js писать пустой
  // массив в fetch-cache (иначе stale empty переживёт deploy).
  if (empty) {
    noStore();
  }

  return (
    <>
      <HvacInfoHeader />
      <main className="hvac-content">
        <NewsFeedHero items={items} />
        <div className="rt-feed-controls-row">
          <Suspense fallback={null}>
            <NewsCategoryFilter items={items} />
          </Suspense>
          <Suspense fallback={null}>
            <NewsViewSwitcher />
          </Suspense>
          <style>{`
            .rt-feed-controls-row {
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding-right: 40px;
            }
            .rt-feed-controls-row > nav { flex: 1; min-width: 0; }
            @media (max-width: 1023px) {
              .rt-feed-controls-row {
                flex-direction: column;
                align-items: stretch;
                padding-right: 12px;
                gap: 8px;
              }
              .rt-feed-controls-row > div[role="tablist"] {
                align-self: flex-end;
                margin-right: 12px;
              }
            }
          `}</style>
        </div>
        <Suspense fallback={null}>
          <NewsFeedList
            items={items}
            hasMore={!!firstPage.next}
            totalCount={firstPage.count ?? items.length}
            skipFirst={5}
          />
        </Suspense>
      </main>
      <SectionFooter />
    </>
  );
}
