'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { NEWS_CATEGORIES } from './newsHelpers';

export default function NewsCategoryFilter() {
  const router = useRouter();
  const params = useSearchParams();
  const active = params?.get('category') || 'all';

  const setCategory = (code: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (code === 'all') next.delete('category');
    else next.set('category', code);
    const qs = next.toString();
    router.replace(qs ? `/?${qs}` : '/', { scroll: false });
  };

  return (
    <nav
      aria-label="Категории"
      style={{
        padding: '14px 40px',
        borderBottom: '1px solid hsl(var(--rt-border-subtle))',
        display: 'flex',
        gap: 6,
        flexWrap: 'wrap',
      }}
      className="rt-feed-chips"
    >
      {NEWS_CATEGORIES.map((c) => {
        const isActive = c.code === active;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => setCategory(c.code)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              borderRadius: 14,
              border: isActive
                ? '1px solid hsl(var(--rt-accent))'
                : '1px solid hsl(var(--rt-border))',
              background: isActive
                ? 'hsl(var(--rt-accent-bg))'
                : 'transparent',
              color: isActive
                ? 'hsl(var(--rt-accent))'
                : 'hsl(var(--rt-ink-60))',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'var(--rt-font-sans)',
            }}
          >
            {c.label}
          </button>
        );
      })}

      <style>{`
        @media (max-width: 1023px) {
          .rt-feed-chips {
            padding: 10px 12px !important;
            flex-wrap: nowrap !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        }
      `}</style>
    </nav>
  );
}
