/**
 * Меню второго уровня /ismeta — chips с разделами продукта.
 *
 * Сейчас активен только «Распознавание». «Прайс-лист» и «Полное описание» —
 * заглушки на будущее (будем работать с распознанной спецификацией: накидать
 * стоимость работ, материалов и т.д.).
 *
 * Стилистика повторяет chip-навигацию из rating-split-system (DetailAnchorNav).
 */
'use client';

import type { CSSProperties } from 'react';

interface IsmetaTab {
  id: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
}

const TABS: IsmetaTab[] = [
  { id: 'recognize', label: 'Распознавание', active: true },
  { id: 'pricelist', label: 'Прайс-лист', disabled: true },
  { id: 'description', label: 'Полное описание', disabled: true },
];

const baseChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 16px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: 'inherit',
  border: '1px solid hsl(var(--rt-border-subtle))',
  background: 'transparent',
  color: 'hsl(var(--rt-ink-60))',
  textDecoration: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const activeChip: CSSProperties = {
  ...baseChip,
  background: 'hsl(var(--rt-ink))',
  color: 'hsl(var(--rt-paper))',
  borderColor: 'hsl(var(--rt-ink))',
  cursor: 'default',
};

const disabledChip: CSSProperties = {
  ...baseChip,
  color: 'hsl(var(--rt-ink-40))',
  cursor: 'not-allowed',
};

export default function IsmetaTabs() {
  return (
    <nav
      aria-label="Разделы ISmeta"
      style={{
        borderBottom: '1px solid hsl(var(--rt-border-subtle))',
        background: 'hsl(var(--rt-paper))',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '14px 40px',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {TABS.map((tab) => {
          if (tab.active) {
            return (
              <span key={tab.id} style={activeChip}>
                {tab.label}
              </span>
            );
          }
          return (
            <span
              key={tab.id}
              style={disabledChip}
              title="Скоро"
              aria-disabled="true"
            >
              {tab.label}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
