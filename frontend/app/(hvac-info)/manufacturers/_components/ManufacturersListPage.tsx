import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import SectionFooter from '../../_components/SectionFooter';
import { H, T } from '../../rating-split-system/_components/primitives';
import type { ManufacturersPageData } from '../_helpers';
import { PAGE_SIZE } from '../_helpers';
import ManufacturersPagination from './ManufacturersPagination';

export default function ManufacturersListPage({ data }: { data: ManufacturersPageData }) {
  const { items, totalCount, currentPage, totalPages } = data;
  const startPosition = (currentPage - 1) * PAGE_SIZE + 1;

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Производители HVAC-оборудования',
    numberOfItems: totalCount,
    itemListElement: items.map((m, i) => ({
      '@type': 'ListItem',
      position: startPosition + i,
      item: {
        '@type': 'Organization',
        name: m.name,
        url: m.website || undefined,
        description: m.description || undefined,
      },
    })),
  };

  return (
    <>
      <HvacInfoHeader />
      <main className="hvac-content">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
        />

        <section style={{ padding: '32px 40px' }}>
          <H as="h1" size={30} serif style={{ marginBottom: 8, letterSpacing: -0.5 }}>
            Производители HVAC-оборудования
            {currentPage > 1 ? ` — страница ${currentPage}` : ''}
          </H>
          <T size={14} color="hsl(var(--rt-ink-60))" style={{ display: 'block', marginBottom: 28 }}>
            {totalCount} производителей в каталоге
            {totalPages > 1 ? ` · страница ${currentPage} из ${totalPages}` : ''}
          </T>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((manufacturer) => (
              <article
                key={manufacturer.id}
                className="rt-public-card"
                style={{
                  background: 'hsl(var(--rt-paper))',
                  color: 'hsl(var(--rt-ink))',
                  border: '1px solid hsl(var(--rt-border-subtle))',
                  borderRadius: 8,
                  padding: 20,
                  transition: 'box-shadow 0.2s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  {manufacturer.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={manufacturer.logo}
                      alt={manufacturer.name}
                      loading="lazy"
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: 'contain',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <H as="h2" size={18}>
                      {manufacturer.name}
                    </H>
                    {manufacturer.country && (
                      <T size={13} color="hsl(var(--rt-ink-60))" style={{ display: 'block', marginTop: 2 }}>
                        {manufacturer.country}
                      </T>
                    )}
                    {manufacturer.description && (
                      <T
                        size={13}
                        color="hsl(var(--rt-ink-60))"
                        style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          marginTop: 8,
                        }}
                      >
                        {manufacturer.description}
                      </T>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 12,
                        flexWrap: 'wrap',
                      }}
                    >
                      {manufacturer.news_count > 0 && (
                        <T size={12} color="hsl(var(--rt-ink-60))">
                          {manufacturer.news_count} новостей
                        </T>
                      )}
                      {manufacturer.brands_count > 0 && (
                        <T size={12} color="hsl(var(--rt-ink-60))">
                          {manufacturer.brands_count} брендов
                        </T>
                      )}
                      {manufacturer.website && (
                        <a
                          href={manufacturer.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: 'hsl(var(--rt-accent))',
                            textDecoration: 'none',
                            fontFamily: 'var(--rt-font-sans)',
                          }}
                          className="rt-public-link"
                        >
                          Сайт
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <ManufacturersPagination currentPage={currentPage} totalPages={totalPages} />
        </section>
      </main>
      <SectionFooter />
      <style>{`
        .rt-public-card:hover { box-shadow: 0 4px 16px hsl(var(--rt-ink) / 0.08); }
        .rt-public-link:hover { text-decoration: underline; }
      `}</style>
    </>
  );
}
