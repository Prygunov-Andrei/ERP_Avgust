import type { CSSProperties } from 'react';
import Link from 'next/link';

interface Props {
  currentPage: number;
  totalPages: number;
}

function pageHref(page: number): string {
  return page === 1 ? '/manufacturers' : `/manufacturers/page/${page}`;
}

function buildWindow(current: number, total: number): Array<number | 'gap'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | 'gap'> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('gap');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}

const cellBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 14px',
  borderRadius: 4,
  fontSize: 13,
  fontFamily: 'var(--rt-font-sans)',
  border: '1px solid hsl(var(--rt-border-subtle))',
  color: 'hsl(var(--rt-ink))',
  textDecoration: 'none',
  background: 'transparent',
};

const cellDisabled: CSSProperties = {
  ...cellBase,
  color: 'hsl(var(--rt-ink-40))',
  opacity: 0.6,
  cursor: 'default',
};

const cellActive: CSSProperties = {
  ...cellBase,
  background: 'hsl(var(--rt-ink))',
  color: 'hsl(var(--rt-paper))',
  borderColor: 'hsl(var(--rt-ink))',
  fontWeight: 600,
};

export default function ManufacturersPagination({ currentPage, totalPages }: Props) {
  if (totalPages <= 1) return null;
  const windowItems = buildWindow(currentPage, totalPages);
  const prev = currentPage > 1 ? currentPage - 1 : null;
  const next = currentPage < totalPages ? currentPage + 1 : null;

  return (
    <nav
      aria-label="Пагинация"
      style={{
        marginTop: 40,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      {prev !== null ? (
        <Link href={pageHref(prev)} rel="prev" style={cellBase} className="rt-pag-cell">
          ← Назад
        </Link>
      ) : (
        <span aria-disabled="true" style={cellDisabled}>
          ← Назад
        </span>
      )}

      <ul
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 4,
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {windowItems.map((item, idx) =>
          item === 'gap' ? (
            <li
              key={`gap-${idx}`}
              style={{
                padding: '0 8px',
                color: 'hsl(var(--rt-ink-40))',
                fontSize: 13,
                fontFamily: 'var(--rt-font-sans)',
              }}
            >
              …
            </li>
          ) : item === currentPage ? (
            <li key={item}>
              <span aria-current="page" style={cellActive}>
                {item}
              </span>
            </li>
          ) : (
            <li key={item}>
              <Link href={pageHref(item)} style={cellBase} className="rt-pag-cell">
                {item}
              </Link>
            </li>
          ),
        )}
      </ul>

      {next !== null ? (
        <Link href={pageHref(next)} rel="next" style={cellBase} className="rt-pag-cell">
          Вперёд →
        </Link>
      ) : (
        <span aria-disabled="true" style={cellDisabled}>
          Вперёд →
        </span>
      )}

      <span
        style={{
          marginLeft: 8,
          fontSize: 12,
          color: 'hsl(var(--rt-ink-60))',
          fontFamily: 'var(--rt-font-mono)',
        }}
      >
        Стр. {currentPage} из {totalPages}
      </span>
      <style>{`
        .rt-pag-cell:hover { background: hsl(var(--rt-chip)); }
      `}</style>
    </nav>
  );
}
