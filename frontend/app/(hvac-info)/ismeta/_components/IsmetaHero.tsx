/**
 * Hero блок главной /ismeta — на всю ширину, с цветным фоном.
 * Стилистика и max-width 1280 повторяют HeroBlock из rating-split-system.
 *
 * Illustration: иллюстрация стопки спецификаций от руки на белом фоне.
 * Dark theme через CSS filter invert+hue-rotate (как в rating HeroIllustration)
 * — одна WebP покрывает обе темы, не плодим артефактов.
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
          alignItems: 'center',
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

        <HeroIllustration />
      </div>
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/ismeta-hero/ismeta-hero.webp"
        alt=""
        width={520}
        height={350}
        loading="eager"
        decoding="async"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
        }}
      />
      <style>{`
        .rt-ismeta-hero-illustration {
          flex: 0 0 420px;
          max-width: 520px;
          padding: 4px;
        }
        @media (max-width: 899px) {
          .rt-ismeta-hero-illustration {
            flex: 1 1 100%;
            max-width: 100%;
          }
        }
        @media (prefers-color-scheme: dark) {
          .rt-ismeta-hero-illustration img { filter: invert(1) hue-rotate(180deg) brightness(1.25); }
        }
        .dark .rt-ismeta-hero-illustration img { filter: invert(1) hue-rotate(180deg) brightness(1.25); }
      `}</style>
    </div>
  );
}
