'use client';

import { useState } from 'react';
import type {
  IsmetaLlmProfileOption,
  IsmetaPipelineOption,
} from '@/lib/api/types/hvac-ismeta-public';

export interface SettingsPanelProps {
  pipelines: IsmetaPipelineOption[];
  llmProfiles: IsmetaLlmProfileOption[];
  pipelineId: string;
  llmProfileId: number | null;
  email: string;
  onPipelineChange: (id: string) => void;
  onLlmChange: (id: number) => void;
  onEmailChange: (value: string) => void;
  disabled?: boolean;
}

export function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function SettingsPanel({
  pipelines,
  llmProfiles,
  pipelineId,
  llmProfileId,
  email,
  onPipelineChange,
  onLlmChange,
  onEmailChange,
  disabled = false,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const emailValid = isValidEmail(email);
  const activePipeline =
    pipelines.find((p) => p.id === pipelineId) ?? pipelines[0];

  return (
    <div
      style={{
        marginTop: 20,
        border: '1px solid hsl(var(--rt-border-subtle))',
        borderRadius: 10,
        background: 'hsl(var(--rt-paper))',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="ismeta-settings-panel"
        data-testid="ismeta-settings-toggle"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'hsl(var(--rt-ink))',
          fontSize: 14,
          fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <span>Дополнительные настройки</span>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms',
            color: 'hsl(var(--rt-ink-60))',
          }}
        >
          ▾
        </span>
      </button>
      {open && (
        <div
          id="ismeta-settings-panel"
          style={{
            padding: '4px 18px 18px',
            display: 'grid',
            gap: 14,
          }}
        >
          <Field label="Движок распознавания" htmlFor="ismeta-pipeline">
            <select
              id="ismeta-pipeline"
              value={pipelineId}
              onChange={(e) => onPipelineChange(e.target.value)}
              disabled={disabled || pipelines.length === 0}
              data-testid="ismeta-pipeline-select"
              style={selectStyle}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            {activePipeline?.description && (
              <Hint>{activePipeline.description}</Hint>
            )}
          </Field>

          <Field label="ИИ-модель" htmlFor="ismeta-llm">
            <select
              id="ismeta-llm"
              value={llmProfileId ?? ''}
              onChange={(e) => onLlmChange(Number(e.target.value))}
              disabled={disabled || llmProfiles.length === 0}
              data-testid="ismeta-llm-select"
              style={selectStyle}
            >
              {llmProfiles.length === 0 && (
                <option value="">Загрузка…</option>
              )}
              {llmProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.vision ? ' · vision' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Email (опционально — пришлём ссылку на результат)"
            htmlFor="ismeta-email"
          >
            <input
              id="ismeta-email"
              type="email"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              disabled={disabled}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!emailValid || undefined}
              data-testid="ismeta-email-input"
              style={{
                ...selectStyle,
                borderColor: emailValid
                  ? 'hsl(var(--rt-border-subtle))'
                  : 'hsl(0 60% 55%)',
              }}
            />
            {!emailValid && (
              <Hint color="hsl(0 60% 45%)">
                Похоже, email указан с опечаткой.
              </Hint>
            )}
          </Field>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'hsl(var(--rt-ink-60))',
          letterSpacing: 0.1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Hint({
  children,
  color = 'hsl(var(--rt-ink-60))',
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span style={{ fontSize: 12, color }}>{children}</span>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 8,
  border: '1px solid hsl(var(--rt-border-subtle))',
  background: 'hsl(var(--rt-paper))',
  color: 'hsl(var(--rt-ink))',
  fontSize: 14,
  fontFamily: 'inherit',
};
