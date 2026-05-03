import type { Metadata } from 'next';
import HvacInfoHeader from '@/components/hvac-info/HvacInfoHeader';
import SectionFooter from '../_components/SectionFooter';
import IsmetaHero from './_components/IsmetaHero';
import IsmetaTabs from './_components/IsmetaTabs';
import IsmetaApp from './_components/IsmetaApp';
import FAQ from './_components/FAQ';

// Страница интерактивна (drag&drop, polling) — отдаём dynamic, чтобы Next
// не пытался prerender'ить состояние клиента и не зашивал stale HTML.
export const dynamic = 'force-dynamic';

const PAGE_TITLE = 'ISmeta — распознавание спецификаций ОВиК';
const PAGE_DESCRIPTION =
  'Загрузите PDF спецификации ОВиК и получите готовую таблицу позиций в Excel за несколько минут. Поддерживаются выгрузки из AutoCAD, Revit, MagiCAD. Бесплатно, без регистрации.';

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
      <IsmetaHero />
      <IsmetaTabs />
      <main
        className="hvac-content"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '36px 40px 56px',
        }}
      >
        <IsmetaApp />
        <FAQ />
      </main>
      <SectionFooter />
    </>
  );
}
