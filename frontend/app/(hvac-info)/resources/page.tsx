export const dynamic = "force-dynamic";
import type { Metadata } from 'next';
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import { getResources } from '@/lib/hvac-api';
import SectionFooter from '../_components/SectionFooter';
import { H, T } from '../rating-split-system/_components/primitives';

export const metadata: Metadata = {
  title: 'Ресурсы и источники',
  description: 'Полезные ресурсы и источники новостей HVAC-индустрии',
  alternates: { canonical: '/resources' },
};

export default async function ResourcesPage() {
  const data = await getResources();

  return (
    <>
      <HvacInfoHeader />
      <main className="hvac-content">
        <section style={{ padding: '32px 40px' }}>
          <H as="h1" size={30} serif style={{ marginBottom: 8, letterSpacing: -0.5 }}>
            Ресурсы и источники
          </H>
          <T size={14} color="hsl(var(--rt-ink-60))" style={{ display: 'block', marginBottom: 28 }}>
            {data.length} источников новостей HVAC-индустрии
          </T>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.map((resource) => (
              <article
                key={resource.id}
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
                  {resource.name}
                </H>
                {resource.description && (
                  <T size={13} color="hsl(var(--rt-ink-60))" style={{ display: 'block', marginTop: 8 }}>
                    {resource.description}
                  </T>
                )}
                {resource.url && (
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rt-public-link"
                    style={{
                      display: 'inline-block',
                      marginTop: 12,
                      fontSize: 13,
                      color: 'hsl(var(--rt-accent))',
                      textDecoration: 'none',
                      fontFamily: 'var(--rt-font-sans)',
                    }}
                  >
                    Перейти на сайт →
                  </a>
                )}
              </article>
            ))}
          </div>
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
