import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MANGU Publishers - Your digital publishing platform';
export const size = { width: 1200, height: 600 };
export const contentType = 'image/png';

export default async function TwitterImage() {
  return new ImageResponse(
    (
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
        {/* Radial glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 20% 80%, rgba(255,215,0,0.12) 0%, transparent 45%), radial-gradient(circle at 80% 20%, rgba(138,43,226,0.12) 0%, transparent 45%)',
          }}
        />

        {/* Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 10,
            padding: '50px',
          }}
        >
          <p
            style={{
              fontSize: '18px',
              fontWeight: 500,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '20px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Discover Stories
          </p>

          <h1
            style={{
              fontSize: '110px',
              fontWeight: 300,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              lineHeight: 1,
              background: 'linear-gradient(45deg, #ffd700, #ff8c00, #ff6b6b)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              marginBottom: '10px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            MANGU
          </h1>

          <h2
            style={{
              fontSize: '52px',
              fontWeight: 300,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.2,
              marginBottom: '32px',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            PUBLISHERS
          </h2>

          <div
            style={{
              width: '100px',
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #ef4444, transparent)',
              marginBottom: '32px',
            }}
          />

          <p
            style={{
              fontSize: '24px',
              fontWeight: 300,
              color: 'rgba(255,255,255,0.7)',
              textAlign: 'center',
              maxWidth: '600px',
              lineHeight: 1.5,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            Stream unlimited books, audiobooks, and exclusive videos
          </p>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '40px',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.4)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            manguprojectz.vercel.app
          </p>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: 'Inter',
          data: await fetch(
            'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyeMZ1rib2Bg-4.ttf'
          ).then((r) => r.arrayBuffer()),
          style: 'normal',
          weight: 300,
        },
      ],
    }
  );
}
