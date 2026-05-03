'use client';

/**
 * F8-Sprint4 — единый ProgressView для public (hvac-info) и админки.
 *
 * Источник данных: GET /api/hvac/ismeta/jobs/<id>/progress (Redis live-state +
 * БД). Recognition пишет phase/pages_processed/items_count/eta после каждой
 * фазы парсинга, frontend poll'ит раз в 2.5 сек и рендерит:
 *   - progress bar (определённый или индетерминатный)
 *   - название фазы + «страница K из N»
 *   - найдено M позиций
 *   - ETA «осталось ~N мин»
 *   - чек-лист фаз (extract → ... → merge → done)
 */

import type { IsmetaProgressPhase } from '@/lib/api/types/hvac-ismeta-public';

export interface ProgressViewProps {
  pagesProcessed: number;
  pagesTotal: number;
  itemsCount: number;
  pipelineId: string;
  /** queued / processing — для UX-сообщения. */
  backendStatus: 'queued' | 'processing' | 'done' | 'error' | 'cancelled';
  /** F8-Sprint4 live-state (опц., при отсутствии Redis — '' / null). */
  phase?: IsmetaProgressPhase | '';
  currentPageLabel?: string;
  elapsedSeconds?: number | null;
  etaSeconds?: number | null;
}

export const PIPELINE_AVG_SEC_PER_PAGE: Record<string, number> = {
  td17g: 5,
  main: 30,
};

export const DEFAULT_AVG_SEC_PER_PAGE = 8;

/**
 * Список фаз для чек-листа. Порядок важен — UI рисует «✓ extract → … → merge».
 * `queued` исключён: это псевдо-фаза «job ещё не подхвачен worker'ом», не
 * показываем в чек-листе.
 */
const PHASE_SEQUENCE: { id: IsmetaProgressPhase; label: string }[] = [
  { id: 'extract', label: 'Извлечение текста' },
  { id: 'tabletransformer', label: 'Распознавание таблиц' },
  { id: 'camelot', label: 'Lattice-извлечение' },
  { id: 'llm_normalize', label: 'Нормализация LLM' },
  { id: 'vision_llm', label: 'Vision LLM' },
  { id: 'merge', label: 'Сборка результата' },
];

function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `≈${Math.round(seconds)} сек`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `≈${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `≈${hours} ч` : `≈${hours} ч ${rest} мин`;
}

function pluralPositions(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'позиция';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
    return 'позиции';
  return 'позиций';
}

/**
 * Какие фазы считать пройденными при текущей. Линейная схема: всё, что выше
 * по порядку PHASE_SEQUENCE, помечается «✓»; текущая — активная; остальные —
 * «pending». `vision_llm` может быть и до `llm_normalize` (TD-17g) и после
 * (multimodal retry), поэтому при vision_llm считаем что extract/table/llm
 * уже пройдены.
 */
function computePhaseState(
  current: IsmetaProgressPhase | '',
  index: number,
): 'done' | 'active' | 'pending' {
  if (!current || current === 'queued') return 'pending';
  if (current === 'done') return 'done';
  const id = PHASE_SEQUENCE[index].id;
  if (id === current) return 'active';
  // Линейный порядок: фазы до текущей — done.
  const phaseOrder: Record<string, number> = {
    extract: 0,
    tabletransformer: 1,
    camelot: 2,
    llm_normalize: 3,
    vision_llm: 4,
    merge: 5,
  };
  const myOrder = phaseOrder[id] ?? -1;
  const curOrder = phaseOrder[current] ?? -1;
  if (myOrder < 0 || curOrder < 0) return 'pending';
  return myOrder < curOrder ? 'done' : 'pending';
}

export default function ProgressView({
  pagesProcessed,
  pagesTotal,
  itemsCount,
  pipelineId,
  backendStatus,
  phase = '',
  currentPageLabel = '',
  elapsedSeconds = null,
  etaSeconds = null,
}: ProgressViewProps) {
  const known = pagesTotal > 0;
  const percent = known
    ? Math.min(100, Math.round((pagesProcessed / pagesTotal) * 100))
    : null;

  const avgSec =
    PIPELINE_AVG_SEC_PER_PAGE[pipelineId] ?? DEFAULT_AVG_SEC_PER_PAGE;
  const fallbackEta = known
    ? Math.max(0, pagesTotal - pagesProcessed) * avgSec
    : 0;
  // Явный live-eta из recognition выигрывает у локальной эвристики, иначе
  // fallback. 0/null означает «не показывать» — для extract phase, где
  // pages_processed ещё 0.
  const effectiveEta =
    etaSeconds != null && etaSeconds > 0 ? etaSeconds : fallbackEta;
  const eta = known && effectiveEta > 0 ? formatEta(effectiveEta) : '';

  const isQueued =
    backendStatus === 'queued' || (!known && pagesProcessed === 0 && !phase);

  const headline = (() => {
    if (isQueued) return 'Подготавливаем PDF к обработке…';
    if (currentPageLabel) return currentPageLabel;
    if (known)
      return `Обработка: страница ${pagesProcessed} из ${pagesTotal}`;
    return 'Идёт распознавание…';
  })();

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
        <div
          data-testid="ismeta-progress-headline"
          style={{ fontSize: 16, fontWeight: 600, color: 'hsl(var(--rt-ink))' }}
        >
          {headline}
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
          flexWrap: 'wrap',
          gap: 8,
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
          {elapsedSeconds != null && elapsedSeconds > 0 && (
            <> · прошло {formatEta(elapsedSeconds)}</>
          )}
        </span>
        {eta && <span data-testid="ismeta-progress-eta">осталось {eta}</span>}
      </div>

      {phase && phase !== 'queued' && phase !== 'done' && (
        <div
          data-testid="ismeta-progress-phases"
          style={{
            marginTop: 16,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
          }}
        >
          {PHASE_SEQUENCE.map((p, idx) => {
            const phaseState = computePhaseState(phase, idx);
            const color =
              phaseState === 'done'
                ? 'hsl(140 50% 35%)'
                : phaseState === 'active'
                  ? 'hsl(var(--rt-accent))'
                  : 'hsl(var(--rt-ink-25))';
            const fontWeight = phaseState === 'active' ? 600 : 400;
            return (
              <span
                key={p.id}
                data-phase={p.id}
                data-phase-state={phaseState}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  color,
                  fontWeight,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background:
                    phaseState === 'active'
                      ? 'hsl(var(--rt-accent) / 0.1)'
                      : 'transparent',
                }}
              >
                <span aria-hidden>
                  {phaseState === 'done'
                    ? '✓'
                    : phaseState === 'active'
                      ? '●'
                      : '○'}
                </span>
                {p.label}
              </span>
            );
          })}
        </div>
      )}

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
