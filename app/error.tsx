'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
        <main style={{ maxWidth: 920, margin: '0 auto', padding: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>Something went wrong</h1>
          <p style={{ color: '#666' }}>Open the browser console for details. This page prevents a blank screen during demo.</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 12, borderRadius: 8, border: '1px solid #eee' }}>
            {error?.message ?? String(error)}
          </pre>
          <button onClick={() => reset()} style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', background: '#fff' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
