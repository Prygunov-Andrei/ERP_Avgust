type Props = {
  title: string;
  phase: string;
  designRef: string;
  description?: string;
};

export default function ComingSoon({ title, phase, designRef, description }: Props) {
  return (
    <main
      style={{
        padding: '48px 40px',
        maxWidth: 1280,
        margin: '0 auto',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--rt-font-mono)',
          fontSize: 10,
          fontWeight: 500,
          color: 'hsl(var(--rt-ink-40))',
          textTransform: 'uppercase',
          letterSpacing: 1.4,
          marginBottom: 12,
        }}
      >
        {phase}
      </p>
      <h1
        style={{
          fontFamily: 'var(--rt-font-serif)',
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: -0.3,
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          color: 'hsl(var(--rt-ink-60))',
          marginTop: 12,
          fontSize: 15,
          lineHeight: 1.5,
        }}
      >
        {description ?? 'Страница в разработке.'}
      </p>
      <p
        style={{
          fontFamily: 'var(--rt-font-mono)',
          fontSize: 11,
          color: 'hsl(var(--rt-ink-40))',
          marginTop: 24,
        }}
      >
        Дизайн: {designRef}
      </p>
    </main>
  );
}
