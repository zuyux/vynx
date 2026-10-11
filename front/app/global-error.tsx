'use client';

export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <html lang="en"><body style={{ margin: 0, background: '#07070a', color: 'white', fontFamily: 'sans-serif' }}>
    <main id="main-content" tabIndex={-1} role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24 }}>
      <h1>We couldn’t open VYNX</h1>
      <p>Please try again in a moment.</p>
      <button type="button" onClick={retry} style={{ padding: '12px 20px', cursor: 'pointer' }}>Try again</button>
      {/* Reload the document when the root layout or router has failed. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" style={{ marginLeft: 20, color: 'white' }}>Go home</a>
    </main>
  </body></html>;
}
