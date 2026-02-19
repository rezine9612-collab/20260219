'use client'

import { useState } from 'react'
import Report from './components/Report'

export default function Page() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any | null>(null)

  async function run() {
    const t = text.trim()
    if (!t) return
    setLoading(true)
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t })
      })
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>NeuPrint MVP</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
          Fixture-first, derive-driven. No client-side logic exposure.
        </div>
      </header>

      <section style={{ marginBottom: 16 }}>
        <textarea
          id="intakeText"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste reasoning text here..."
          style={{ width: '100%', height: 160, padding: 12, borderRadius: 10, border: '1px solid #ddd' }}
        />
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            id="ctaBtn"
            onClick={run}
            disabled={loading}
            style={{ padding: '10px 16px', borderRadius: 10, background: '#111', color: '#fff', border: 'none' }}
          >
            {loading ? 'Analyzing...' : 'Run Analysis'}
          </button>
          <span style={{ fontSize: 12, color: '#666' }}>
            {data ? 'Report ready' : 'No report yet'}
          </span>
        </div>
      </section>

      <Report data={data} />
    </main>
  )
}
