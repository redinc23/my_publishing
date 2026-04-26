import Link from 'next/link';

export default function Custom404() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1rem',
        textAlign: 'center',
      }}
    >
      <div>
        <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>404</h1>
        <p style={{ marginBottom: '1rem' }}>The page you requested could not be found.</p>
        <Link href="/">Return home</Link>
      </div>
    </main>
  );
}
