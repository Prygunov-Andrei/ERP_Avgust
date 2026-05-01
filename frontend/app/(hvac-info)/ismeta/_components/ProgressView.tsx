'use client';

import { DEFAULT_AVG_SEC_PER_PAGE, PIPELINE_AVG_SEC_PER_PAGE } from './types';

export interface ProgressViewProps {
  pagesProcessed: number;
  pagesTotal: number;
  itemsCount: number;
  pipelineId: string;
  /** queued / processing — для UX-сообщения. */
  backendStatus: 'queued' | 'processing' | 'done' | 'error' | 'cancelled';
}

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `≈${Math.round(seconds)} сек`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `≈${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `≈${hours} ч` : `≈${hours} ч ${rest} мин`;
}

export default function ProgressView({
  pagesProcessed,
  pagesTotal,
  itemsCount,
  pipelineId,
  backendStatus,
}: ProgressViewProps) {
  const known = pagesTotal > 0;
  const percent = known
    ? Math.min(100, Math.round((pagesProcessed / pagesTotal) * 100))
    : null;

  const avgSec =
    PIPELINE_AVG_SEC_PER_PAGE[pipelineId] ?? DEFAULT_AVG_SEC_PER_PAGE;
  const remaining = known
    ? Math.max(0, pagesTotal - pagesProcessed) * avgSec
    : 0;
  const eta = known ? formatEta(remaining) : '';

  const isQueued = backendStatus === 'queued' || (!known && pagesProcessed === 0);

  return (
    <div
      data-testid="ismeta-progress"
      role="status"
      aria-live="polite"
      style={{
        marginTop: 32,
        padding: '24px',
        borderRadius: 12,
        background: 'hsl(var(--rt-alt))',
        border: '1px solid hsl(var(--rt-border-subtle))',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <Spinner />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'hsl(var(--rt-ink))' }}>
          {isQueued
            ? 'Подготавливаем PDF к обработке…'
            : known
              ? `Обработка: страница ${pagesProcessed} из ${pagesTotal}`
              : 'Идёт распознавание…'}
        </div>
      </div>

      <div
        aria-hidden={!known}
        style={{
          height: 10,
          borderRadius: 999,
          background: 'hsl(var(--rt-border-subtle))',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          data-testid="ismeta-progress-bar"
          style={{
            height: '100%',
            width: known ? `${percent ?? 0}%` : '40%',
            background: 'hsl(var(--rt-accent))',
            transition: 'width 400ms ease-out',
            animation: known
              ? undefined
              : 'ismeta-indeterminate 1.4s ease-in-out infinite',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          fontSize: 13,
          color: 'hsl(var(--rt-ink-60))',
        }}
      >
        <span>
          {known ? `${percent}%` : ''}
          {itemsCount > 0 && (
            <>
              {known ? ' · ' : ''}найдено {itemsCount}{' '}
              {pluralPositions(itemsCount)}
            </>
          )}
        </span>
        {eta && <span data-testid="ismeta-progress-eta">осталось {eta}</span>}
      </div>

      <style>{`
        @keyframes ismeta-indeterminate {
          0% { width: 10%; margin-left: 0%; }
          50% { width: 35%; margin-left: 30%; }
          100% { width: 10%; margin-left: 90%; }
        }
      `}</style>
    </div>
  );
}

function pluralPositions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'позиция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return 'позиции';
  return 'позиций';
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '2px solid hsl(var(--rt-border-subtle))',
        borderTopColor: 'hsl(var(--rt-accent))',
        animation: 'ismeta-spin 0.9s linear infinite',
      }}
    >
      <style>{`@keyframes ismeta-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}
