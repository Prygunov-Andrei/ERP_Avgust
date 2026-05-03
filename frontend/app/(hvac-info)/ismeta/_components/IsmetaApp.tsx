'use client';

import { useEffect, useState } from 'react';
import type {
  IsmetaLlmProfileOption,
  IsmetaPipelineOption,
} from '@/lib/api/types/hvac-ismeta-public';
import { hvacIsmetaPublicService } from '@/lib/api/services/hvac-ismeta-public';
import UploadZone from './UploadZone';
import ProgressView from './ProgressView';
import ResultView from './ResultView';
import FeedbackForm from './FeedbackForm';
import { useIsmetaJob } from './useIsmetaJob';

const FALLBACK_PIPELINES: IsmetaPipelineOption[] = [
  {
    id: 'td17g',
    label: 'Быстрый (TD-17g)',
    description: '~5 мин на спецификацию, $0.36 в среднем',
    default: true,
  },
];

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function IsmetaApp() {
  const { state, start, reset } = useIsmetaJob();

  // SettingsPanel убран по решению PO 2026-05-03 — pipeline и LLM-провайдер
  // выбираются в ERP админке (HvacIsmetaSettings.default_*). Публичный UI
  // использует backend defaults; запрос /options всё ещё дёргаем, чтобы
  // знать какой pipeline передать в Celery task (на будущее).
  const [pipelines, setPipelines] = useState<IsmetaPipelineOption[]>(
    FALLBACK_PIPELINES,
  );
  const [llmProfiles, setLlmProfiles] = useState<IsmetaLlmProfileOption[]>([]);
  const [pipelineId, setPipelineId] = useState<string>(FALLBACK_PIPELINES[0].id);
  const [llmProfileId, setLlmProfileId] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    hvacIsmetaPublicService
      .getOptions()
      .then((opts) => {
        if (cancelled) return;
        if (opts.pipelines.length > 0) {
          setPipelines(opts.pipelines);
          const def = opts.pipelines.find((p) => p.default) ?? opts.pipelines[0];
          setPipelineId(def.id);
        }
        if (opts.llm_profiles.length > 0) {
          setLlmProfiles(opts.llm_profiles);
          const def =
            opts.llm_profiles.find((p) => p.default) ?? opts.llm_profiles[0];
          setLlmProfileId(def.id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить настройки';
        setOptionsError(message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isBusy = state.status === 'uploading' || state.status === 'processing';
  const emailValid = isValidEmail(email);
  const canSubmit =
    state.status === 'idle' &&
    file !== null &&
    pipelines.length > 0 &&
    emailValid;

  const handleSubmit = () => {
    if (!file) return;
    void start(file, {
      pipeline: pipelineId,
      llm_profile_id: llmProfileId ?? undefined,
      email: email.trim() || undefined,
    });
  };

  const handleReset = () => {
    setFile(null);
    reset();
  };

  // Чтобы ничего не болталось: подавим warning о неиспользуемом llmProfiles в UI.
  void llmProfiles;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {(state.status === 'idle' ||
        state.status === 'uploading' ||
        state.status === 'error') && (
        <>
          <UploadZone
            onFile={setFile}
            disabled={isBusy}
            selectedFileName={file?.name ?? null}
          />

          {/* Email + Распознать одной строкой */}
          <div
            style={{
              marginTop: 18,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 280px', minWidth: 260 }}>
              <input
                id="ismeta-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBusy}
                placeholder="email — пришлём ссылку на готовую таблицу (опционально)"
                autoComplete="email"
                aria-invalid={!emailValid || undefined}
                aria-label="Email для уведомления о готовности"
                data-testid="ismeta-email-input"
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1px solid ${
                    emailValid
                      ? 'hsl(var(--rt-border-subtle))'
                      : 'hsl(0 60% 55%)'
                  }`,
                  background: 'hsl(var(--rt-paper))',
                  color: 'hsl(var(--rt-ink))',
                  fontSize: 15,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
              {!emailValid && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: 'hsl(0 60% 45%)',
                  }}
                >
                  Похоже, email указан с опечаткой.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isBusy}
              data-testid="ismeta-submit"
              style={{
                padding: '14px 28px',
                background: canSubmit
                  ? 'hsl(var(--rt-accent))'
                  : 'hsl(var(--rt-ink-25))',
                color: 'hsl(var(--rt-paper))',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: canSubmit && !isBusy ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                transition: 'background 120ms',
                whiteSpace: 'nowrap',
              }}
            >
              {state.status === 'uploading' ? 'Загружаем…' : 'Распознать →'}
            </button>
            {file && state.status === 'idle' && (
              <button
                type="button"
                onClick={() => setFile(null)}
                style={{
                  padding: '14px 18px',
                  background: 'transparent',
                  color: 'hsl(var(--rt-ink-60))',
                  border: '1px solid hsl(var(--rt-border-subtle))',
                  borderRadius: 10,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Убрать файл
              </button>
            )}
          </div>

          {optionsError && (
            <div
              role="alert"
              style={{
                marginTop: 12,
                fontSize: 13,
                color: 'hsl(0 60% 35%)',
              }}
            >
              Не удалось загрузить настройки: {optionsError}. Используем
              значения по умолчанию.
            </div>
          )}

          {state.status === 'error' && (
            <div
              role="alert"
              data-testid="ismeta-error"
              style={{
                marginTop: 18,
                padding: '14px 16px',
                borderRadius: 10,
                background: state.serviceDown
                  ? 'hsl(40 80% 95%)'
                  : 'hsl(0 75% 95%)',
                color: state.serviceDown ? 'hsl(35 70% 30%)' : 'hsl(0 60% 35%)',
                fontSize: 14,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {state.concurrency
                  ? 'Уже идёт обработка'
                  : state.serviceDown
                    ? 'Сервис временно недоступен'
                    : 'Не удалось распознать PDF'}
              </div>
              <div style={{ fontSize: 13 }}>{state.message}</div>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  marginTop: 10,
                  padding: '8px 14px',
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid currentColor',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Попробовать снова
              </button>
            </div>
          )}
        </>
      )}

      {state.status === 'processing' && (
        <ProgressView
          pagesProcessed={state.pagesProcessed}
          pagesTotal={state.pagesTotal}
          itemsCount={state.itemsCount}
          pipelineId={pipelineId}
          backendStatus={state.backendStatus}
          phase={state.phase}
          currentPageLabel={state.currentPageLabel}
          elapsedSeconds={state.elapsedSeconds}
          etaSeconds={state.etaSeconds}
        />
      )}

      {state.status === 'done' && (
        <>
          <ResultView
            jobId={state.jobId}
            items={state.items}
            itemsCount={state.itemsCount}
            pagesStats={state.pagesStats}
            onReset={handleReset}
          />
          <FeedbackForm jobId={state.jobId} />
        </>
      )}
    </div>
  );
}
