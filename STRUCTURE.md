NeuPrint minimal structure (fixture mode)

- app/api/analyze/route.ts             API route (fixture -> derive -> merge -> report)
- lib/server/derive.ts                 derive entry that imports 4 modules
- lib/server/derive/{rsl,cff,rc,rfs}.ts  calculation modules
- lib/server/meta.ts                   meta + verification id helpers (server-side)
- lib/fixtures/fixture_analysis_input_v1.json  fixture envelope (analysis_input + gpt_text + meta)
- prototypes/*.html                    static prototypes (optional)


## v11
- Removed runtime execution of prototype HTML scripts.
- Main UI is TSX-only (page.tsx + components/Report.tsx).
- prototypes/ remains for reference only; app does not depend on it.
