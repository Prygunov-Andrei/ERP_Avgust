import type { CSSProperties } from 'react';

const ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Какие PDF поддерживаются?',
    a: 'Спецификации ОВиК с табличной разметкой — выгрузки из AutoCAD, Revit, MagiCAD и аналогов. Сканы (растровые PDF) обрабатываются хуже: лучше использовать электронные версии. Поддерживаются книжная и альбомная ориентация, многостраничные файлы.',
  },
  {
    q: 'Сколько это занимает?',
    a: 'Быстрый движок (TD-17g) обрабатывает спецификацию в 3–10 листов за 2–7 минут. Точный движок (main) запускает полный pipeline и нужен для нестандартных таблиц — там обработка занимает до часа.',
  },
  {
    q: 'Что мы делаем с PDF?',
    a: 'PDF используется только для распознавания. Мы не передаём файл и распознанные данные третьим лицам, не используем для обучения моделей. Файлы и результаты автоматически удаляются с серверов через несколько суток.',
  },
];

export default function FAQ() {
  return (
    <section
      style={{
        marginTop: 48,
        paddingTop: 32,
        borderTop: '1px solid hsl(var(--rt-border-subtle))',
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: 'hsl(var(--rt-ink))',
          marginBottom: 16,
        }}
      >
        Частые вопросы
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {ITEMS.map((item) => (
          <details key={item.q} style={detailsStyle}>
            <summary style={summaryStyle}>{item.q}</summary>
            <p
              style={{
                margin: '8px 0 0',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'hsl(var(--rt-ink-80))',
              }}
            >
              {item.a}
            </p>
          </details>
        ))}
      </div>
      <p
        style={{
          marginTop: 24,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'hsl(var(--rt-alt))',
          fontSize: 13,
          color: 'hsl(var(--rt-ink-60))',
          lineHeight: 1.5,
        }}
      >
        Загруженные PDF используются только для распознавания. Мы не передаём
        файлы и данные третьим лицам и не используем их для обучения моделей.
      </p>
    </section>
  );
}

const detailsStyle: CSSProperties = {
  padding: '14px 16px',
  borderRadius: 10,
  border: '1px solid hsl(var(--rt-border-subtle))',
  background: 'hsl(var(--rt-paper))',
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  fontSize: 15,
  fontWeight: 600,
  color: 'hsl(var(--rt-ink))',
  listStyle: 'revert',
};
