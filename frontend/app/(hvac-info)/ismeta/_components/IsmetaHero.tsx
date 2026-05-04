/**
 * Hero блок раздела /ismeta — повторяет стилистику rating-split-system HeroBlock:
 * - section на всю ширину с фоном hsl(var(--rt-alt)), max-width=1280
 * - Eyebrow сверху, H1 serif 34px, intro 14px, chips внизу — всё внутри блока
 * - Illustration справа на >=1024px, скрыта на mobile
 *
 * Чипы — заглушки под будущие разделы (Прайс-лист, Полное описание). «Распознавание»
 * не показываем — это и есть текущая страница.
 *
 * IsmetaHeroCollapsed — мини-версия для StickyCollapseHero (sticky-rail при scroll
 * вниз, как в rating).
 */
import { Eyebrow, H, T } from '../../rating-split-system/_components/primitives';

const HERO_TITLE = 'ISmeta — распознавание спецификаций ОВиК';
const HERO_INTRO =
  'Загрузите PDF-спецификацию — получите готовую таблицу позиций в Excel за несколько минут. Распознаём наименования, типы, марки, бренды и количество.';
const HERO_EYEBROW = 'Инструмент · Бесплатно · Без регистрации';

const STUB_TABS: Array<{ label: string }> = [
  { label: 'Прайс-лист' },
  { label: 'Полное описание' },
];

export default function IsmetaHero() {
  return (
    <section
      style={{
        background: 'hsl(var(--rt-alt))',
        borderBottom: '1px solid hsl(var(--rt-border-subtle))',
      }}
      className="rt-hero"
    >
      <div
        className="rt-hero-inner"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '40px 40px 36px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 24,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          <Eyebrow>{HERO_EYEBROW}</Eyebrow>
        </div>
        <div className="rt-ismeta-hero-grid">
          <div>
            <H size={34} serif as="h1" style={{ letterSpacing: -0.5, lineHeight: 1.2 }}>
              {HERO_TITLE}
            </H>
            <T
              size={14}
              color="hsl(var(--rt-ink-60))"
              style={{ marginTop: 14, lineHeight: 1.6, display: 'block', maxWidth: 640 }}
            >
              {HERO_INTRO}
            </T>
            <div
              style={{
                marginTop: 22,
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <Eyebrow style={{ marginRight: 6 }}>Разделы:</Eyebrow>
              {STUB_TABS.map(({ label }) => (
                <span
                  key={label}
                  title="Скоро"
                  aria-disabled="true"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    border: '1px solid hsl(var(--rt-border))',
                    borderRadius: 14,
                    fontSize: 11,
                    color: 'hsl(var(--rt-ink-40))',
                    background: 'transparent',
                    cursor: 'not-allowed',
                    fontWeight: 500,
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <HeroIllustration />
        </div>
      </div>
      <style>{`
        .rt-ismeta-hero-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
          align-items: center;
        }
        .rt-ismeta-hero-illustration { display: none; }
        @media (min-width: 1024px) {
          .rt-ismeta-hero-grid {
            grid-template-columns: 1fr 460px;
            gap: 48px;
          }
          .rt-ismeta-hero-illustration { display: flex; }
        }
        @media (max-width: 899px) {
          .rt-hero-inner { padding: 24px 20px 22px !important; }
        }
      `}</style>
    </section>
  );
}

function HeroIllustration() {
  return (
    <div
      className="rt-ismeta-hero-illustration"
      role="img"
      aria-label="Иллюстрация — стопка чертежей со спецификацией оборудования ОВиК"
    >
      {/* Две версии: light = фото с белой бумагой (как «лист чертежа»),
          dark = инвертированная. Переключение через .dark класс или
          prefers-color-scheme. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="rt-ismeta-hero-img rt-ismeta-hero-img-light"
        src="/ismeta-hero/ismeta-hero-light.webp"
        alt=""
        width={520}
        height={350}
        loading="eager"
        decoding="async"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="rt-ismeta-hero-img rt-ismeta-hero-img-dark"
        src="/ismeta-hero/ismeta-hero-dark.webp"
        alt=""
        width={520}
        height={350}
        loading="eager"
        decoding="async"
      />
      <style>{`
        .rt-ismeta-hero-illustration {
          justify-content: center;
          align-items: center;
          padding: 8px;
        }
        .rt-ismeta-hero-img {
          width: 100%;
          height: auto;
          display: block;
          object-fit: contain;
          border-radius: 6px;
        }
        .rt-ismeta-hero-img-dark { display: none; }
        /* Тема приложения управляется ТОЛЬКО через .dark класс на html.
           prefers-color-scheme media НЕ используем — system dark mode не
           должен переключать картинку, если сайт остался в light theme. */
        .dark .rt-ismeta-hero-img-light { display: none; }
        .dark .rt-ismeta-hero-img-dark { display: block; }
      `}</style>
    </div>
  );
}

export function IsmetaHeroCollapsed() {
  return (
    <section
      style={{
        background: 'hsl(var(--rt-alt))',
        borderBottom: '1px solid hsl(var(--rt-border-subtle))',
      }}
      className="rt-hero-collapsed"
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '12px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'nowrap',
          overflow: 'hidden',
        }}
      >
        <Eyebrow style={{ flexShrink: 0 }}>
          ISmeta · распознавание спецификаций ОВиК
        </Eyebrow>
        <span
          style={{
            fontSize: 11,
            color: 'hsl(var(--rt-ink-60))',
            whiteSpace: 'nowrap',
          }}
          className="rt-hero-collapsed-tagline"
        >
          Бесплатно · Без регистрации
        </span>
      </div>
      <style>{`
        @media (max-width: 899px) {
          .rt-hero-collapsed-tagline { display: none !important; }
        }
      `}</style>
    </section>
  );
}
