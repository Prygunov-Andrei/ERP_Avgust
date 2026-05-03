'use client';

import { useState } from 'react';
import { hvacIsmetaPublicService } from '@/lib/api/services/hvac-ismeta-public';

function isValidEmail(value: string): boolean {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export interface FeedbackFormProps {
  jobId: string;
}

export default function FeedbackForm({ jobId }: FeedbackFormProps) {
  const [helpful, setHelpful] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = isValidEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (helpful === null || submitting) return;
    if (!emailValid) return;
    setSubmitting(true);
    setError(null);
    try {
      await hvacIsmetaPublicService.sendFeedback({
        job_id: jobId,
        helpful,
        comment: comment.trim() || undefined,
        contact_email: email.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось отправить отзыв';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        role="status"
        data-testid="ismeta-feedback-thanks"
        style={{
          marginTop: 24,
          padding: '18px 20px',
          borderRadius: 10,
          background: 'hsl(140 50% 95%)',
          color: 'hsl(140 40% 25%)',
          fontSize: 14,
        }}
      >
        Спасибо за отзыв! Это помогает нам улучшать распознавание.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="ismeta-feedback-form"
      style={{
        marginTop: 32,
        padding: '20px 24px',
        borderRadius: 12,
        background: 'hsl(var(--rt-alt))',
        border: '1px solid hsl(var(--rt-border-subtle))',
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: 'hsl(var(--rt-ink))',
          marginBottom: 14,
        }}
      >
        Помог инструмент?
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <RatingButton
          active={helpful === true}
          onClick={() => setHelpful(true)}
          label="Да"
          icon="👍"
          testid="ismeta-feedback-up"
        />
        <RatingButton
          active={helpful === false}
          onClick={() => setHelpful(false)}
          label="Нет"
          icon="👎"
          testid="ismeta-feedback-down"
        />
      </div>

      {helpful !== null && (
        <div style={{ display: 'grid', gap: 12 }}>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'hsl(var(--rt-ink-60))',
              textTransform: 'uppercase',
              letterSpacing: 0.1,
            }}
          >
            Что улучшить? (опционально)
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={
                helpful
                  ? 'Что особенно понравилось?'
                  : 'Какие позиции пропали или распозналось не так?'
              }
              data-testid="ismeta-feedback-comment"
              style={{
                marginTop: 6,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid hsl(var(--rt-border-subtle))',
                background: 'hsl(var(--rt-paper))',
                color: 'hsl(var(--rt-ink))',
                fontSize: 14,
                fontFamily: 'inherit',
                resize: 'vertical',
                textTransform: 'none',
                letterSpacing: 0,
              }}
            />
          </label>
          <label
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'hsl(var(--rt-ink-60))',
              textTransform: 'uppercase',
              letterSpacing: 0.1,
            }}
          >
            Email (если хотите ответ)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              aria-invalid={!emailValid || undefined}
              data-testid="ismeta-feedback-email"
              style={{
                marginTop: 6,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${emailValid ? 'hsl(var(--rt-border-subtle))' : 'hsl(0 60% 55%)'}`,
                background: 'hsl(var(--rt-paper))',
                color: 'hsl(var(--rt-ink))',
                fontSize: 14,
                fontFamily: 'inherit',
                textTransform: 'none',
                letterSpacing: 0,
              }}
            />
          </label>
          <button
            type="submit"
            disabled={submitting || !emailValid}
            data-testid="ismeta-feedback-submit"
            style={{
              alignSelf: 'flex-start',
              padding: '10px 20px',
              borderRadius: 8,
              background: 'hsl(var(--rt-ink))',
              color: 'hsl(var(--rt-paper))',
              border: 'none',
              fontSize: 14,
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              opacity: !emailValid ? 0.5 : 1,
              fontFamily: 'inherit',
            }}
          >
            {submitting ? 'Отправляем…' : 'Отправить'}
          </button>
          {error && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: 'hsl(0 60% 35%)',
              }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

function RatingButton({
  active,
  onClick,
  label,
  icon,
  testid,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  testid: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testid}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '10px 18px',
        borderRadius: 999,
        background: active
          ? 'hsl(var(--rt-ink))'
          : 'hsl(var(--rt-paper))',
        color: active ? 'hsl(var(--rt-paper))' : 'hsl(var(--rt-ink))',
        border: `1px solid ${active ? 'hsl(var(--rt-ink))' : 'hsl(var(--rt-border-subtle))'}`,
        fontSize: 14,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
