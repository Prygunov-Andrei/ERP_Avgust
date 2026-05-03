/**
 * FAQ под /ismeta — простой текст без collapsible. Privacy-disclaimer убран:
 * вопрос «Безопасно ли загружать PDF» уже отвечает на это.
 */

const FAQ_ITEMS: Array<{ q: string; a: string }> = [
  {
    q: 'Какие PDF поддерживаются?',
    a: 'PDF спецификации ОВиК — оригинальные выгрузки из AutoCAD, Revit, MagiCAD и сканы. Лимит — 50 МБ.',
  },
  {
    q: 'Сколько ждать результат?',
    a: 'Обычно 3–7 минут на спецификацию до 30 страниц. Большие документы (50+ страниц) — до получаса.',
  },
  {
    q: 'Что я получу в Excel?',
    a: 'Таблицу со столбцами: № позиции, раздел, наименование, модель/марка, бренд, производитель, ед. изм., количество, страница. Готова к копированию в смету.',
  },
  {
    q: 'Безопасно ли загружать PDF?',
    a: 'Загруженные файлы используются только для распознавания и хранятся на наших серверах для контроля качества. Мы не передаём данные третьим лицам и не используем их для обучения моделей.',
  },
  {
    q: 'Если распознало неточно?',
    a: 'Оставьте отзыв 👎 + комментарий — поможете нам сделать инструмент лучше. Каждый отзыв читаем вручную.',
  },
];

export default function FAQ() {
  return (
    <section
      style={{
        marginTop: 56,
        paddingTop: 32,
        borderTop: '1px solid hsl(var(--rt-border-subtle))',
      }}
    >
      <h2
        style={{
          fontFamily: 'var(--rt-font-serif), serif',
          fontSize: 22,
          fontWeight: 600,
          color: 'hsl(var(--rt-ink))',
          margin: 0,
          marginBottom: 24,
        }}
      >
        Частые вопросы
      </h2>
      <dl
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
          margin: 0,
        }}
      >
        {FAQ_ITEMS.map((item) => (
          <div key={item.q}>
            <dt
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'hsl(var(--rt-ink))',
                marginBottom: 6,
              }}
            >
              {item.q}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.55,
                color: 'hsl(var(--rt-ink-80))',
              }}
            >
              {item.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
