import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getRatingMethodology,
  getRatingModels,
} from '@/lib/api/services/rating';
import RatingPageContent from '../../_components/RatingPageContent';

export const revalidate = 3600;

export interface PriceSlugDef {
  slug: string;
  priceMax: number;
  label: string;
}

export const PRICE_SLUGS: readonly PriceSlugDef[] = [
  { slug: 'do-20000-rub', priceMax: 20000, label: 'до 20 000 ₽' },
  { slug: 'do-25000-rub', priceMax: 25000, label: 'до 25 000 ₽' },
  { slug: 'do-30000-rub', priceMax: 30000, label: 'до 30 000 ₽' },
  { slug: 'do-35000-rub', priceMax: 35000, label: 'до 35 000 ₽' },
  { slug: 'do-40000-rub', priceMax: 40000, label: 'до 40 000 ₽' },
  { slug: 'do-50000-rub', priceMax: 50000, label: 'до 50 000 ₽' },
  { slug: 'do-60000-rub', priceMax: 60000, label: 'до 60 000 ₽' },
] as const;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return PRICE_SLUGS.map((p) => ({ slug: p.slug }));
}

function findSlug(slug: string): PriceSlugDef | undefined {
  return PRICE_SLUGS.find((p) => p.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const def = findSlug(slug);
  if (!def) return { title: 'Страница не найдена' };
  const title = `Кондиционеры ${def.label} — рейтинг | HVAC Info`;
  const description = `Лучшие кондиционеры стоимостью ${def.label} — рейтинг по интегральному индексу «Август-климат». Сравнение по характеристикам, шуму, энергоэффективности.`;
  return {
    title,
    description,
    alternates: { canonical: `/rating-split-system/price/${def.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function PriceRatingPage({ params }: Props) {
  const { slug } = await params;
  const def = findSlug(slug);
  if (!def) notFound();

  let models: Awaited<ReturnType<typeof getRatingModels>> = [];
  let methodology: Awaited<ReturnType<typeof getRatingMethodology>> = {
    version: '',
    name: '',
    criteria: [],
    stats: { total_models: 0, active_criteria_count: 0, median_total_index: 0 },
    presets: [],
  };
  try {
    [models, methodology] = await Promise.all([
      getRatingModels({ priceMax: def.priceMax }),
      getRatingMethodology(),
    ]);
  } catch (e) {
    console.error('[ratings-price] fetch failed, rendering empty:', e);
  }

  // На случай если backend (AC-Петя) ещё не поддерживает price_max — отфильтровать
  // на клиенте: цена ≤ priceMax (модели без указанной цены оставляем в результате,
  // чтобы редакция могла позже их озвучить, но они отсортируются вниз).
  const inBudget = models
    .filter((m) => m.publish_status === 'published')
    .filter((m) => {
      if (m.price == null) return true;
      const n = Number(m.price);
      if (!Number.isFinite(n)) return true;
      return n <= def.priceMax;
    });

  const heroTitle = `Кондиционеры ${def.label} — рейтинг`;
  const heroIntro = `Сплит-системы стоимостью ${def.label}, отсортированные по интегральному индексу «Август-климат». Сравнение по уровню шума, энергоэффективности и качеству комплектующих — все модели проверены по единой методике.`;

  return (
    <RatingPageContent
      models={inBudget}
      methodology={methodology}
      hero={{
        title: heroTitle,
        eyebrow: `Бюджет ${def.label} · 04.2026`,
        intro: heroIntro,
      }}
      mobileHero={{
        title: heroTitle,
        eyebrow: `${def.label} · 04.2026`,
      }}
    />
  );
}
