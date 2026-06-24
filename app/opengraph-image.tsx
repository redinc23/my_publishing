import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MANGU Publishers - Your digital publishing platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const interFontPromise = fetch(
  'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyeMZ1rib2Bg-4.ttf',
  { cache: 'force-cache' }
).then((response) => response.arrayBuffer());

export default async function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 80%, rgba(255,215,0,0.12) 0%, transparent 45%), radial-gradient(circle at 80% 20%, rgba(138,43,226,0.12) 0%, transparent 45%), radial-gradient(circle at 40% 40%, rgba(0,115,230,0.08) 0%, transparent 45%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.03,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 10,
          padding: '60px',
        }}
      >
        <p
          style={{
            fontSize: '20px',
            fontWeight: 500,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '24px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Welcome to
        </p>

        <h1
          style={{
            fontSize: '120px',
            fontWeight: 300,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            lineHeight: 1,
            background: 'linear-gradient(45deg, #ffd700, #ff8c00, #ff6b6b)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            marginBottom: '12px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          MANGU
        </h1>

        <h2
          style={{
            fontSize: '60px',
            fontWeight: 300,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.2,
            marginBottom: '40px',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          PUBLISHERS
        </h2>

        <div
          style={{
            width: '120px',
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
            marginBottom: '40px',
          }}
        />

        <p
          style={{
            fontSize: '28px',
            fontWeight: 300,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.5,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Discover a universe of stories
        </p>

        <p
          style={{
            position: 'absolute',
            bottom: '-40px',
            fontSize: '16px',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          manguprojectz.vercel.app
        </p>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: await interFontPromise,
          style: 'normal',
          weight: 300,
        },
      ],
    }
  );
}
