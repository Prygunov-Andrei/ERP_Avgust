'use client';

import type {
  IsmetaItem,
  IsmetaPagesStats,
} from '@/lib/api/types/hvac-ismeta-public';
import { hvacIsmetaPublicService } from '@/lib/api/services/hvac-ismeta-public';

const PREVIEW_LIMIT = 50;

export interface ResultViewProps {
  jobId: string;
  items: IsmetaItem[];
  itemsCount: number;
  pagesStats: IsmetaPagesStats;
  onReset: () => void;
}

export default function ResultView({
  jobId,
  items,
  itemsCount,
  pagesStats,
  onReset,
}: ResultViewProps) {
  const previewItems = items.slice(0, PREVIEW_LIMIT);
  const hasMore = items.length > PREVIEW_LIMIT;
  const downloadUrl = hvacIsmetaPublicService.excelDownloadUrl(jobId);

  return (
    <div
      data-testid="ismeta-result"
      style={{
        marginTop: 32,
        padding: '24px',
        borderRadius: 12,
        background: 'hsl(var(--rt-paper))',
        border: '1px solid hsl(var(--rt-border-subtle))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <span aria-hidden style={{ fontSize: 24, lineHeight: 1 }}>
          ✅
        </span>
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'hsl(var(--rt-ink))',
              marginBottom: 4,
            }}
          >
            Готово! Найдено {itemsCount} {pluralPositions(itemsCount)} на{' '}
            {pagesStats.processed} {pluralPages(pagesStats.processed)}.
          </div>
          {pagesStats.skipped > 0 && (
            <div style={{ fontSize: 13, color: 'hsl(var(--rt-ink-60))' }}>
              Пропущено страниц: {pagesStats.skipped} (нечитаемые / без таблиц).
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 24,
        }}
      >
        <a
          href={downloadUrl}
          download
          data-testid="ismeta-excel-download"
          style={primaryBtnStyle}
        >
          ⬇ Скачать Excel
        </a>
        <button
          type="button"
          onClick={onReset}
          data-testid="ismeta-reset"
          style={secondaryBtnStyle}
        >
          Загрузить новый PDF
        </button>
      </div>

      {previewItems.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              color: 'hsl(var(--rt-ink-60))',
              marginBottom: 10,
            }}
          >
            Превью {previewItems.length === items.length ? 'всех' : 'первых'} {previewItems.length}{' '}
            {pluralPositions(previewItems.length)}
            {hasMore && ' (полный список — в Excel)'}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table
              data-testid="ismeta-result-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 13,
                minWidth: 560,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: 'hsl(var(--rt-alt))',
                    color: 'hsl(var(--rt-ink-60))',
                    textAlign: 'left',
                  }}
                >
                  <Th style={{ width: 56 }}>Поз</Th>
                  <Th>Наименование</Th>
                  <Th>Тип / марка</Th>
                  <Th style={{ width: 80, textAlign: 'right' }}>Кол-во</Th>
                  <Th style={{ width: 64 }}>Ед.</Th>
                </tr>
              </thead>
              <tbody>
                {previewItems.map((item, idx) => (
                  <tr
                    key={`${item.position}-${idx}`}
                    style={{
                      borderTop: '1px solid hsl(var(--rt-border-subtle))',
                    }}
                  >
                    <Td>{item.position}</Td>
                    <Td>{item.name}</Td>
                    <Td>{item.model}</Td>
                    <Td style={{ textAlign: 'right' }}>{item.qty}</Td>
                    <Td>{item.unit}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: '10px 12px',
        fontWeight: 600,
        fontSize: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        padding: '10px 12px',
        color: 'hsl(var(--rt-ink))',
        verticalAlign: 'top',
        ...style,
      }}
    >
      {children}
    </td>
  );
}

function pluralPositions(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'позиция';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'позиции';
  return 'позиций';
}

function pluralPages(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'странице';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'страницах';
  return 'страницах';
}

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 20px',
  background: 'hsl(var(--rt-ink))',
  color: 'hsl(var(--rt-paper))',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
};

const secondaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 18px',
  background: 'transparent',
  color: 'hsl(var(--rt-ink))',
  border: '1px solid hsl(var(--rt-border-subtle))',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
