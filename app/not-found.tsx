export default function NotFound() {
  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: 24, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}>
      <h1 style={{ margin: 0, fontSize: 20 }}>Page not found</h1>
      <p style={{ color: '#666' }}>Return to the home page.</p>
      <a href="/" style={{ textDecoration: 'underline' }}>Go to Home</a>
    </main>
  )
}
