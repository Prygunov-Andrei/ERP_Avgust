export const dynamic = "force-dynamic";
import type { Metadata } from 'next';
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import { getBrands } from '@/lib/hvac-api';
import SectionFooter from '../_components/SectionFooter';
import { H, T } from '../rating-split-system/_components/primitives';

export const metadata: Metadata = {
  title: 'Бренды HVAC-оборудования',
  description: 'Каталог брендов оборудования для отопления, вентиляции и кондиционирования',
  alternates: { canonical: '/brands' },
};

export default async function BrandsPage() {
  const data = await getBrands();

  return (
    <>
      <HvacInfoHeader />
      <main className="hvac-content">
        <section style={{ padding: '32px 40px' }}>
          <H as="h1" size={30} serif style={{ marginBottom: 8, letterSpacing: -0.5 }}>
            Бренды HVAC-оборудования
          </H>
          <T size={14} color="hsl(var(--rt-ink-60))" style={{ display: 'block', marginBottom: 28 }}>
            {data.length} брендов в каталоге
          </T>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((brand) => (
              <article
                key={brand.id}
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
                <H as="h2" size={18}>
                  {brand.name}
                </H>
                {brand.manufacturer && (
                  <T size={13} color="hsl(var(--rt-ink-60))" style={{ display: 'block', marginTop: 4 }}>
                    {brand.manufacturer.name}
                  </T>
                )}
                {brand.description && (
                  <T
                    size={13}
                    color="hsl(var(--rt-ink-60))"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginTop: 8,
                    }}
                  >
                    {brand.description}
                  </T>
                )}
              </article>
            ))}
          </div>
        </section>
      </main>
      <SectionFooter />
      <style>{`
        .rt-public-card:hover { box-shadow: 0 4px 16px hsl(var(--rt-ink) / 0.08); }
      `}</style>
    </>
  );
}
