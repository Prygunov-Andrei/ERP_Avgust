/**
 * Hero блок главной /ismeta — на всю ширину, с цветным фоном.
 * Стилистика и max-width 1280 повторяют HeroBlock из rating-split-system.
 * Места под illustration — справа, аналогично rating hero.
 */
import { Eyebrow } from '../../rating-split-system/_components/primitives';

export default function IsmetaHero() {
  return (
    <section
      className="rt-hero"
      style={{
        background: 'hsl(var(--rt-alt))',
        borderBottom: '1px solid hsl(var(--rt-border-subtle))',
      }}
    >
      <div
        className="rt-hero-inner"
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '40px 40px 36px',
          display: 'flex',
          gap: 32,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 520px', minWidth: 0 }}>
          <Eyebrow style={{ marginBottom: 14 }}>
            Инструмент · Бесплатно · Без регистрации
          </Eyebrow>
          <h1
            style={{
              fontFamily: 'var(--rt-font-serif), serif',
              fontSize: 'clamp(28px, 4vw, 40px)',
              fontWeight: 700,
              lineHeight: 1.12,
              color: 'hsl(var(--rt-ink))',
              margin: 0,
              marginBottom: 16,
              letterSpacing: -0.5,
            }}
          >
            ISmeta — распознавание спецификаций ОВиК
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.5,
              color: 'hsl(var(--rt-ink-80))',
              margin: 0,
              maxWidth: 640,
            }}
          >
            Загрузите PDF-спецификацию — получите готовую таблицу позиций
            в Excel за несколько минут. Распознаём наименования, типы,
            марки, бренды и количество.
          </p>
        </div>

        {/* Место под illustration — заполнит дизайнер. */}
        <div
          aria-hidden
          className="rt-ismeta-hero-illustration"
          style={{
            flex: '0 0 320px',
            minHeight: 200,
            borderRadius: 16,
            background:
              'linear-gradient(135deg, hsl(var(--rt-accent) / 0.10), hsl(var(--rt-accent) / 0.02))',
            border: '1px dashed hsl(var(--rt-border-subtle))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'hsl(var(--rt-ink-40))',
            fontSize: 13,
            fontFamily: 'var(--rt-font-mono)',
          }}
        >
          illustration
        </div>
      </div>
    </section>
  );
}
