import type { Metadata } from 'next';
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import IsmetaApp from './_components/IsmetaApp';
import FAQ from './_components/FAQ';

// Страница интерактивна (drag&drop, polling) — отдаём dynamic, чтобы Next
// не пытался prerender'ить состояние клиента и не зашивал stale HTML.
export const dynamic = 'force-dynamic';

const PAGE_TITLE = 'ISmeta — распознавание спецификаций ОВиК';
const PAGE_DESCRIPTION =
  'Загрузите PDF спецификации ОВиК и получите готовую таблицу позиций в Excel за несколько минут. Поддерживаются выгрузки из AutoCAD, Revit, MagiCAD.';

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: { canonical: '/ismeta' },
  robots: { index: true, follow: true },
  openGraph: {
    title: `${PAGE_TITLE} | HVAC Info`,
    description: PAGE_DESCRIPTION,
    type: 'website',
    url: 'https://hvac-info.com/ismeta',
  },
};

export default function IsmetaPage() {
  return (
    <>
      <HvacInfoHeader />
      <main
        className="hvac-content"
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: '40px 24px 64px',
        }}
      >
        <nav
          aria-label="Хлебные крошки"
          style={{
            fontSize: 12,
            color: 'hsl(var(--rt-ink-60))',
            marginBottom: 16,
            letterSpacing: 0.2,
          }}
        >
          <a
            href="/"
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            Главная
          </a>
          <span aria-hidden style={{ margin: '0 8px' }}>
            ›
          </span>
          <span style={{ color: 'hsl(var(--rt-ink))' }}>ISmeta</span>
        </nav>

        <header style={{ marginBottom: 28 }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontFamily: 'var(--rt-font-mono)',
              textTransform: 'uppercase',
              letterSpacing: 1.4,
              color: 'hsl(var(--rt-accent))',
              marginBottom: 10,
            }}
          >
            Инструмент · Бета
          </span>
          <h1
            style={{
              fontFamily: 'var(--rt-font-serif), serif',
              fontSize: 'clamp(28px, 4vw, 38px)',
              fontWeight: 700,
              lineHeight: 1.15,
              color: 'hsl(var(--rt-ink))',
              margin: 0,
              marginBottom: 12,
            }}
          >
            ISmeta — распознавание спецификаций ОВиК
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.55,
              color: 'hsl(var(--rt-ink-80))',
              margin: 0,
              maxWidth: 640,
            }}
          >
            Загрузите PDF спецификации — получите готовую таблицу позиций в
            Excel за несколько минут. Распознаём наименования, типы, марки и
            количество.
          </p>
        </header>

        <IsmetaApp />

        <FAQ />
      </main>
    </>
  );
}
