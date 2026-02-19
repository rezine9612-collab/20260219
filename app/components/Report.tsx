'use client'

import React, { useMemo, useState } from 'react'

export type NeuPrintReport = Record<string, any>

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: 16, border: '1px solid #eee', borderRadius: 12, background: '#fff' }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  )
}

function KV({ k, v }: { k: string; v: any }) {
  const missing = v === undefined || v === null || v === ''
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', padding: '4px 0' }}>
      <div style={{ width: 220, fontSize: 12, color: '#666' }}>{k}</div>
      <div style={{ fontSize: 13, fontWeight: 650, wordBreak: 'break-word' }}>
        {missing ? <span style={{ color: '#b00' }}>MISSING</span> : String(v)}
      </div>
    </div>
  )
}

function Lines({ lines }: { lines: any }) {
  const arr = Array.isArray(lines) ? lines : typeof lines === 'string' ? [lines] : []
  if (!arr.length) return <div style={{ color: '#b00' }}>MISSING</div>
  return (
    <ul style={{ margin: '8px 0 0 18px' }}>
      {arr.map((t, i) => (
        <li key={i} style={{ marginBottom: 4 }}>
          {String(t)}
        </li>
      ))}
    </ul>
  )
}

export default function Report({ data }: { data: NeuPrintReport | null }) {
  const [showJson, setShowJson] = useState(false)

  const s = useMemo(() => {
    const d = data ?? {}
    return {
      meta: d.meta ?? {},
      hero: d.hero ?? {},
      rsl: d.rsl ?? {},
      cff: d.cff ?? {},
      rc: d.rc ?? {},
      rfs: d.rfs ?? {},
    }
  }, [data])

  if (!data) {
    return (
      <SectionCard title="Report">
        <div style={{ fontSize: 13, color: '#666' }}>No report yet. Paste text and run analysis.</div>
      </SectionCard>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <SectionCard title="Meta">
        <KV k="verification_id" v={s.meta.verification_id} />
        <KV k="generated_at_utc" v={s.meta.generated_at_utc} />
        <KV k="input_language" v={s.meta.input_language} />
        <KV k="verify_url" v={s.meta.verify_url} />
      </SectionCard>

      <SectionCard title="Hero">
        <KV k="rsl_level" v={s.hero.rsl_level ?? s.rsl?.level?.meta?.level_short_name ?? s.rsl?.level} />
        <KV k="determination" v={s.hero.determination ?? s.rc?.determination ?? s.rc?.label} />
        <KV k="fri" v={s.hero.fri ?? s.rsl?.fri ?? s.cff?.fri} />
        <KV k="control" v={s.hero.control ?? s.rc?.control_label ?? s.rc?.control} />
        <KV k="role_fit" v={s.hero.role_fit ?? s.rfs?.top_group ?? s.rfs?.top_groups?.[0]?.group_name} />
      </SectionCard>

      <SectionCard title="RSL Summary">
        <KV k="level" v={s.rsl?.level?.meta?.level_short_name ?? s.rsl?.level} />
        <KV k="rubric_mean_0to5" v={s.rsl?.level?.rubric_mean_0to5 ?? s.rsl?.rubric_mean_0to5} />
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
          {s.rsl?.summary?.one_line ? (
            <div style={{ fontWeight: 800 }}>{String(s.rsl.summary.one_line)}</div>
          ) : (
            <div style={{ color: '#b00' }}>MISSING</div>
          )}
          {s.rsl?.summary?.paragraph ? <div style={{ marginTop: 6, color: '#333' }}>{String(s.rsl.summary.paragraph)}</div> : null}
        </div>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Dimensions</div>
          {Array.isArray(s.rsl?.dimensions) && s.rsl.dimensions.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {s.rsl.dimensions.map((d: any, i: number) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 800 }}>{String(d?.code ?? `D${i + 1}`)}</span>
                  {d?.label ? <span> · {String(d.label)}</span> : null}
                  {d?.score_1to5 !== undefined ? <span> · {String(d.score_1to5)}</span> : null}
                  {d?.observation ? <div style={{ color: '#333', marginTop: 2 }}>{String(d.observation)}</div> : null}
                </li>
              ))}
            </ul>
          ) : (
            <div style={{ color: '#b00' }}>MISSING</div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Reasoning Control">
        <KV k="control_pattern" v={s.rc?.control_pattern} />
        <KV k="reliability_band" v={s.rc?.reliability_band} />

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Reasoning Control Summary</div>
          <Lines lines={s.rc?.summary_lines ?? s.rc?.summary ?? s.rc?.reasoning_control_summary} />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Observed Structural Signals</div>
          <Lines lines={s.rc?.observed_structural_signals ?? s.rc?.observed_signals} />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Structural Control Signals (raw)</div>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              background: '#f7f7f7',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #eee',
              fontSize: 12,
            }}
          >
            {JSON.stringify(s.rc?.structural_control_signals ?? s.rc?.signals ?? {}, null, 2)}
          </pre>
        </div>
      </SectionCard>

      <SectionCard title="Role Fit & Cognitive Style">
        <KV k="primary_pattern" v={s.rfs?.primary_pattern} />
        <KV k="representative_phrase" v={s.rfs?.representative_phrase} />
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5 }}>
          {s.rfs?.pattern_interpretation ? <div>{String(s.rfs.pattern_interpretation)}</div> : <div style={{ color: '#b00' }}>MISSING</div>}
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Summary Lines</div>
          <Lines lines={s.rfs?.summary_lines} />
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Top Groups</div>
          {Array.isArray(s.rfs?.top_groups) && s.rfs.top_groups.length ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {s.rfs.top_groups.map((g: any, i: number) => (
                <div key={i} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontWeight: 800 }}>{String(g?.group_name ?? `Group ${i + 1}`)}</div>
                  {Array.isArray(g?.roles) ? (
                    <div style={{ marginTop: 6, color: '#333' }}>{g.roles.map((r: any) => String(r)).join(', ')}</div>
                  ) : (
                    <div style={{ color: '#b00', marginTop: 6 }}>MISSING</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#b00' }}>MISSING</div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Raw JSON">
        <button
          onClick={() => setShowJson((v) => !v)}
          style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #ddd', background: '#fff' }}
        >
          {showJson ? 'Hide JSON' : 'Show JSON'}
        </button>
        {showJson ? (
          <pre
            style={{
              marginTop: 10,
              whiteSpace: 'pre-wrap',
              background: '#0b1020',
              color: '#e6edf3',
              padding: 12,
              borderRadius: 10,
              border: '1px solid #111',
              fontSize: 12,
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        ) : null}
      </SectionCard>
    </div>
  )
}
