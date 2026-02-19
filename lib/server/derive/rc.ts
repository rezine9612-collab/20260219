
/* =====================
   SOURCE: Backend_8_Reasoning Control Summary.ts
   (verbatim from derive폴더.zip)
===================== */

/* rc.ts (MIN INPUT CONTRACT)
   PURPOSE
   - Accept ONLY the raw_features fields needed to compute RC (Reasoning Control).
   - Compute A,D,R internally from those fields.
   - Output ONLY the final JSON contract:

   {
     "rc": {
       "summary": "...",
       "control_pattern": "Deep Reflective Human",
       "reliability_band": "HIGH" | "MEDIUM" | "LOW",
       "band_rationale": "...",
       "pattern_interpretation": "..."
     }
   }

   RULES
   - Single file.
   - No import of full raw_features schema.
   - Accept only required fields (minimal contract).
   - No *_en fields.
   - Compile-safe: uses global isFinite(), not Number.isFinite().
*/

export type RCInputRaw = {
  layer_0: {
    units: number;
    claims: number;
    reasons: number;
    evidence: number;
  };
  layer_1: {
    counterpoints: number;
    refutations: number;
  };
  layer_2: {
    transitions: number;
    transition_ok: number;
    revisions: number;
    revision_depth_sum: number;
  };
  layer_3: {
    intent_markers: number;
    drift_segments: number;
    self_regulation_signals: number;
  };
};

type ControlVector = { A: number; D: number; R: number };

type ControlPattern =
  | "deep_reflective_human"
  | "moderate_reflective_human"
  | "moderate_procedural_human"
  | "shallow_procedural_human"
  | "moderate_reflective_hybrid"
  | "shallow_procedural_hybrid"
  | "shallow_procedural_ai"
  | "moderate_procedural_ai"
  | "deep_procedural_ai";

type ReliabilityBand = "HIGH" | "MEDIUM" | "LOW";

type ControlPatternMeta = {
  control_pattern: ControlPattern;
  pattern_description: string;
  pattern_interpretation: string;
  band_rationale: string;
};

export type RCOut = {
  summary: string;
  control_pattern: string; // Human-readable label
  reliability_band: ReliabilityBand;
  band_rationale: string;
  pattern_interpretation: string;
};

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && isFinite(x);
}
function n0(x: unknown): number {
  return isFiniteNumber(x) ? x : 0;
}
function clamp01(x: number): number {
  if (!isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function safeDiv(a: number, b: number): number {
  return a / Math.max(1, b);
}
// 0..inf -> 0..1, spike-safe
function sat(x: number, k: number): number {
  const xx = x < 0 ? 0 : x;
  return xx / (xx + k);
}

/* =========================
   1) A,D,R from raw (MIN)
========================= */

function computeADR_min(raw: RCInputRaw): ControlVector {
  const U = Math.max(1, Math.floor(n0(raw?.layer_0?.units)));
  const C = Math.max(0, n0(raw?.layer_0?.claims));
  const reasons = Math.max(0, n0(raw?.layer_0?.reasons));
  const evidence = Math.max(0, n0(raw?.layer_0?.evidence));

  const counterpoints = Math.max(0, n0(raw?.layer_1?.counterpoints));
  const refutations = Math.max(0, n0(raw?.layer_1?.refutations));

  const transitions = Math.max(0, n0(raw?.layer_2?.transitions));
  const transitionOk = Math.max(0, n0(raw?.layer_2?.transition_ok));

  const revisions = Math.max(0, n0(raw?.layer_2?.revisions));
  const revisionDepthSum = Math.max(0, n0(raw?.layer_2?.revision_depth_sum));

  const intentMarkers = Math.max(0, n0(raw?.layer_3?.intent_markers));
  const driftSegments = Math.max(0, n0(raw?.layer_3?.drift_segments));
  const selfReg = Math.max(0, n0(raw?.layer_3?.self_regulation_signals));

  // Normalizations
  const transitionDensity = safeDiv(transitions, U);
  const transitionQuality = clamp01(safeDiv(transitionOk, transitions));

  const revisionRate = safeDiv(revisions, U);
  const revisionDepthAvg = safeDiv(revisionDepthSum, Math.max(1, revisions));

  const counterRate = safeDiv(counterpoints + refutations, Math.max(1, C));
  const intentRate = safeDiv(intentMarkers, U);
  const driftRate = safeDiv(driftSegments, U);

  const reasonRate = safeDiv(reasons, Math.max(1, C));
  const evidenceRate = safeDiv(evidence, Math.max(1, C));

  // A: Agency (minimal signals)
  const A_core =
    0.30 * sat(intentRate, 0.25) +
    0.28 * sat(revisionRate, 0.30) +
    0.24 * sat(counterRate, 0.35) +
    0.12 * transitionQuality +
    0.06 * sat(safeDiv(selfReg, U), 0.20);

  // penalties (keep only drift + low-quality transition under high density)
  const A_penalty =
    0.24 * sat(driftRate, 0.25) +
    0.16 * sat(transitionDensity * (1 - transitionQuality), 0.25);

  const A = clamp01(A_core - A_penalty);

  // D: Depth (minimal: reasons + evidence + structured movement)
  const D_core =
    0.45 * sat(reasonRate, 0.9) +
    0.35 * sat(evidenceRate, 0.7) +
    0.20 * sat(transitionDensity, 0.7);

  const D = clamp01(D_core);

  // R: Reflection (minimal: revision frequency + depth + counter-evaluation + self-reg)
  const R_core =
    0.32 * sat(revisionRate, 0.28) +
    0.24 * sat(revisionDepthAvg, 0.9) +
    0.22 * sat(counterRate, 0.30) +
    0.16 * sat(safeDiv(selfReg, U), 0.25) +
    0.06 * transitionQuality;

  // penalty (keep only drift)
  const R_penalty = 0.12 * sat(driftRate, 0.30);

  const R = clamp01(R_core - R_penalty);

  return { A, D, R };
}

/* =========================
   2) RC pattern meta
========================= */

const CONTROL_PATTERN_META: Record<ControlPattern, ControlPatternMeta> = {
  deep_reflective_human: {
    control_pattern: "deep_reflective_human",
    pattern_description:
      "Human-led reasoning with sustained reflective control and stable structural revision. The current position is centered within the human reasoning cluster.",
    pattern_interpretation:
      "A high human proportion indicates stable human-led control at structural decision boundaries across the task.",
    band_rationale:
      "Reasoning decisions originate from explicit human-driven revision and counter-evaluative judgment rather than automated continuation flow.",
  },
  moderate_reflective_human: {
    control_pattern: "moderate_reflective_human",
    pattern_description:
      "Human-led reasoning with localized reflective adjustment and generally stable structure. The current position remains within the human cluster with moderate dispersion.",
    pattern_interpretation:
      "A high human proportion indicates largely human-led control, with reflective adjustment appearing in localized segments.",
    band_rationale:
      "Reasoning decisions include limited human revision but do not extend to full structural reconfiguration.",
  },
  moderate_procedural_human: {
    control_pattern: "moderate_procedural_human",
    pattern_description:
      "Human-authored reasoning following a stable procedural structure. The current position lies within the human cluster but closer to the procedural boundary.",
    pattern_interpretation:
      "A high human proportion indicates human-led control under a procedural sequence, with limited reflective intervention.",
    band_rationale:
      "Reasoning decisions follow a predefined structural sequence with minimal reflective intervention.",
  },
  shallow_procedural_human: {
    control_pattern: "shallow_procedural_human",
    pattern_description:
      "Human-generated reasoning with shallow procedural progression and limited structural depth. The current position is weakly anchored within the human reasoning cluster.",
    pattern_interpretation:
      "A high human proportion indicates human-led control, though structural decisions tend to follow shallow continuation patterns.",
    band_rationale:
      "Reasoning decisions rely on surface-level continuation rather than deliberate structural control.",
  },
  moderate_reflective_hybrid: {
    control_pattern: "moderate_reflective_hybrid",
    pattern_description:
      "Mixed-agency reasoning with partial human reflection and assisted structural development. The current position spans the boundary between human and hybrid clusters.",
    pattern_interpretation:
      "A mixed distribution indicates shared control, where human intent is present but transitions partially reflect assisted continuation.",
    band_rationale:
      "Reasoning decisions reflect human intent but are partially influenced by assisted continuation patterns.",
  },
  shallow_procedural_hybrid: {
    control_pattern: "shallow_procedural_hybrid",
    pattern_description:
      "Hybrid reasoning with procedural structure and limited reflective control. The current position trends toward the hybrid procedural region.",
    pattern_interpretation:
      "A mixed distribution indicates assisted procedural flow, with limited human-led structural revision at decision boundaries.",
    band_rationale:
      "Reasoning decisions follow assisted procedural flow with minimal human structural revision.",
  },
  shallow_procedural_ai: {
    control_pattern: "shallow_procedural_ai",
    pattern_description:
      "AI-dominant reasoning with shallow procedural expansion. The current position is located near the automated cluster perimeter.",
    pattern_interpretation:
      "A low human proportion indicates control signals are dominated by automated continuation rather than human-led structural decisions.",
    band_rationale:
      "Reasoning decisions primarily arise from automated continuation without observable human control signals.",
  },
  moderate_procedural_ai: {
    control_pattern: "moderate_procedural_ai",
    pattern_description:
      "AI-generated reasoning with stable but non-reflective procedural structure. The current position is centered within the automated reasoning cluster.",
    pattern_interpretation:
      "A low human proportion indicates stable automated continuation patterns with minimal evidence of human-originated structural control.",
    band_rationale:
      "Reasoning decisions follow internally consistent continuation patterns without human-originated revision.",
  },
  deep_procedural_ai: {
    control_pattern: "deep_procedural_ai",
    pattern_description:
      "AI-generated reasoning exhibiting high structural complexity without reflective control. The current position is deeply embedded within the automated procedural cluster.",
    pattern_interpretation:
      "A low human proportion indicates layered procedural expansion without consistent reflective control signals originating from the individual.",
    band_rationale:
      "Reasoning decisions reflect layered procedural expansion rather than intentional evaluative judgment.",
  },
};

const CENTROIDS: Record<ControlPattern, ControlVector> = {
  deep_reflective_human: { A: 0.85, D: 0.8, R: 0.8 },
  moderate_reflective_human: { A: 0.8, D: 0.55, R: 0.6 },
  moderate_procedural_human: { A: 0.75, D: 0.55, R: 0.25 },
  shallow_procedural_human: { A: 0.7, D: 0.3, R: 0.2 },
  moderate_reflective_hybrid: { A: 0.55, D: 0.55, R: 0.55 },
  shallow_procedural_hybrid: { A: 0.5, D: 0.3, R: 0.2 },
  shallow_procedural_ai: { A: 0.2, D: 0.3, R: 0.15 },
  moderate_procedural_ai: { A: 0.15, D: 0.55, R: 0.15 },
  deep_procedural_ai: { A: 0.1, D: 0.8, R: 0.1 },
};

function euclidean(a: ControlVector, b: ControlVector): number {
  const dA = a.A - b.A;
  const dD = a.D - b.D;
  const dR = a.R - b.R;
  return Math.sqrt(dA * dA + dD * dD + dR * dR);
}

function bandFromDistance(d: number): ReliabilityBand {
  if (d < 0.12) return "HIGH";
  if (d < 0.22) return "MEDIUM";
  return "LOW";
}

function formatControlPatternLabel(p: ControlPattern): string {
  return p
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/* =========================
   3) RC inference (nearest centroid)
========================= */

function inferRCFromADR(vIn: ControlVector): RCOut {
  const v: ControlVector = {
    A: clamp01(isFiniteNumber(vIn.A) ? vIn.A : 0.5),
    D: clamp01(isFiniteNumber(vIn.D) ? vIn.D : 0.5),
    R: clamp01(isFiniteNumber(vIn.R) ? vIn.R : 0.5),
  };

  let best: ControlPattern = "moderate_reflective_human";
  let bestDist = Number.POSITIVE_INFINITY;

  (Object.keys(CENTROIDS) as ControlPattern[]).forEach((p) => {
    const d = euclidean(v, CENTROIDS[p]);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  });

  const meta = CONTROL_PATTERN_META[best];
  const rb = bandFromDistance(bestDist);

  return {
    summary: meta.pattern_description,
    control_pattern: formatControlPatternLabel(best),
    reliability_band: rb,
    band_rationale: meta.band_rationale,
    pattern_interpretation: meta.pattern_interpretation,
  };
}

/* =========================
   4) PUBLIC API
   - Takes only needed raw fields
   - Returns only final JSON
========================= */

export function computeRCFromRaw(raw: RCInputRaw): { rc: RCOut } {
  const adr = computeADR_min(raw);
  const rc = inferRCFromADR(adr);
  return { rc };
}


/* =====================
   SOURCE: Backend_9_Observed Structural Signals.ts
   (verbatim from derive폴더.zip)
===================== */

/* Observed Structural Signals — Selection Logic (TypeScript)
   - Library: S1 ~ S18 only (S19/S20 제거)
   - Select up to 4 representative evidence lines for export
   - Output JSON:
     {
       "rc": {
         "observed_structural_signals": {
           "1": "...",
           "2": "...",
           "3": "...",
           "4": "..."
         }
       }
     }
*/

export type Band = "HIGH" | "MEDIUM" | "LOW";

export type SignalGroup =
  | "REVISION"
  | "TRANSITION"
  | "COUNTER"
  | "EVIDENCE"
  | "NONAUTO"
  | "SPECIFICITY";

export interface SignalTemplate {
  id: string; // "S1"..."S18"
  text: string;
  group: SignalGroup;
  /** smaller = higher priority */
  priority: number;
}

export interface SelectObservedSignalsOptions {
  /** Evidence lines to select. Default 4. */
  displayLines?: number;
  /**
   * If actives are insufficient, do NOT invent lines.
   * - "shorten": return fewer evidence lines
   * Default "shorten".
   */
  insufficientPolicy?: "shorten";
}

export interface SelectObservedSignalsResult {
  /** Evidence lines (max 4) */
  lines: string[];
}

export type RcLineIndex = "1" | "2" | "3" | "4";

export interface ObservedSignalsRcJson {
  rc: {
    observed_structural_signals: Record<RcLineIndex, string>;
  };
}

/** Build the canonical library (S1–S18). Single source of truth. */
export function buildSignalLibraryV1_S1toS18(): Record<string, SignalTemplate> {
  return {
    // A) Revision / Self-Regulation (S1–S4)
    S1: {
      id: "S1",
      text: "Revision activity occurs at semantic decision boundaries.",
      group: "REVISION",
      priority: 10,
    },
    S2: {
      id: "S2",
      text: "Argument order adjustments correspond to logical correction.",
      group: "REVISION",
      priority: 20,
    },
    S3: {
      id: "S3",
      text: "Claim scope or conditions are refined through explicit revision.",
      group: "REVISION",
      priority: 30,
    },
    S4: {
      id: "S4",
      text: "Prior assumptions are explicitly re-evaluated during reasoning progression.",
      group: "REVISION",
      priority: 40,
    },

    // B) Transition / Consistency (S5–S7)
    S5: {
      id: "S5",
      text: "Consistency checks appear across structural transitions.",
      group: "TRANSITION",
      priority: 10,
    },
    S6: {
      id: "S6",
      text: "Logical transitions between claims and supporting reasons are explicitly maintained.",
      group: "TRANSITION",
      priority: 20,
    },
    S7: {
      id: "S7",
      text: "Structural continuity is preserved across multi-step reasoning transitions.",
      group: "TRANSITION",
      priority: 30,
    },

    // C) Counter-evaluation / Verification (S8–S10)
    S8: {
      id: "S8",
      text: "Alternative viewpoints are introduced and structurally examined.",
      group: "COUNTER",
      priority: 10,
    },
    S9: {
      id: "S9",
      text: "Counter-arguments are explicitly addressed through refutational reasoning.",
      group: "COUNTER",
      priority: 20,
    },
    S10: {
      id: "S10",
      text: "Evidence is evaluated against potential contradictions rather than accepted at face value.",
      group: "COUNTER",
      priority: 30,
    },

    // D) Evidence Handling (S11–S13)
    S11: {
      id: "S11",
      text: "Multiple evidence types are integrated within the reasoning structure.",
      group: "EVIDENCE",
      priority: 10,
    },
    S12: {
      id: "S12",
      text: "Evidence placement aligns with the logical role it serves within the argument.",
      group: "EVIDENCE",
      priority: 20,
    },
    S13: {
      id: "S13",
      text: "Supporting evidence is selectively introduced at structurally relevant points.",
      group: "EVIDENCE",
      priority: 30,
    },

    // E) Non-Automation / Loop Control (S14–S16)
    S14: {
      id: "S14",
      text: "No sustained repetitive propagation is observed across reasoning segments.",
      group: "NONAUTO",
      priority: 10,
    },
    S15: {
      id: "S15",
      text: "Structural variation is maintained without reliance on template-like repetition.",
      group: "NONAUTO",
      priority: 20,
    },
    S16: {
      id: "S16",
      text: "Reasoning progression avoids uniform continuation patterns across sections.",
      group: "NONAUTO",
      priority: 30,
    },

    // F) Structural Specificity (S17–S18)
    S17: {
      id: "S17",
      text: "Structural behavior reflects document-specific reasoning rather than generic composition patterns.",
      group: "SPECIFICITY",
      priority: 10,
    },
    S18: {
      id: "S18",
      text: "Observed structural signals vary across sections in response to local reasoning demands.",
      group: "SPECIFICITY",
      priority: 20,
    },
  };
}

/**
 * Select representative evidence lines for "Observed Structural Signals".
 * Inputs:
 * - activeIds: template ids that are active (rule-triggered by features)
 * - band: HIGH / MEDIUM / LOW (현재 selection 규칙 자체는 band-independent로 유지 가능)
 *
 * Output:
 * - lines: evidence lines (max displayLines, default 4)
 */
export function selectObservedSignals(
  activeIds: ReadonlySet<string>,
  band: Band,
  opts: SelectObservedSignalsOptions = {}
): SelectObservedSignalsResult {
  const { displayLines = 4, insufficientPolicy = "shorten" } = opts;

  const lib = buildSignalLibraryV1_S1toS18();

  // Remove unknown ids
  const candidates: SignalTemplate[] = [];
  for (const id of activeIds) {
    const t = lib[id];
    if (!t) continue;
    candidates.push(t);
  }

  // Pick best (lowest priority number) within a group
  const pickBest = (group: SignalGroup): SignalTemplate | undefined => {
    let best: SignalTemplate | undefined;
    for (const t of candidates) {
      if (t.group !== group) continue;
      if (!best || t.priority < best.priority) best = t;
    }
    return best;
  };

  const selected: SignalTemplate[] = [];

  // 1) Core groups, one each (fixed order)
  const coreGroupOrder: SignalGroup[] = [
    "REVISION",
    "TRANSITION",
    "COUNTER",
    "NONAUTO",
  ];

  for (const g of coreGroupOrder) {
    if (selected.length >= displayLines) break;
    const t = pickBest(g);
    if (t && !selected.some((x) => x.id === t.id)) selected.push(t);
  }

  // 2) Fill from EVIDENCE then SPECIFICITY
  const fillGroupOrder: SignalGroup[] = ["EVIDENCE", "SPECIFICITY"];
  for (const g of fillGroupOrder) {
    if (selected.length >= displayLines) break;
    const t = pickBest(g);
    if (t && !selected.some((x) => x.id === t.id)) selected.push(t);
  }

  // 3) Final fill from remaining candidates by priority
  if (selected.length < displayLines) {
    const remaining = candidates
      .filter((t) => !selected.some((x) => x.id === t.id))
      .sort((a, b) => a.priority - b.priority);

    for (const t of remaining) {
      if (selected.length >= displayLines) break;
      selected.push(t);
    }
  }

  let lines = selected.map((t) => t.text).slice(0, displayLines);

  // Insufficient candidates policy (현재는 shorten만 허용)
  if (lines.length < displayLines && insufficientPolicy === "shorten") {
    // do nothing: return fewer lines
  }

  // band는 현재 selection 규칙에 직접 영향 없지만, 외부에서 필요하면 audit/log로 쓸 수 있어
  void band;

  return { lines };
}

/**
 * Final export JSON:
 * - Always returns keys "1".."4"
 * - If fewer evidence lines exist, remaining are ""
 */
export function toRcJson(result: SelectObservedSignalsResult): ObservedSignalsRcJson {
  const evidence = result.lines;

  const pick = (i: number) => (i < evidence.length ? evidence[i] : "");

  return {
    rc: {
      observed_structural_signals: {
        "1": pick(0),
        "2": pick(1),
        "3": pick(2),
        "4": pick(3),
      },
    },
  };
}

/* -------------------------
   Example usage (Node/TS runtime)
-------------------------- */
if (require?.main === module) {
  const active = new Set<string>(["S1", "S2", "S5", "S9", "S14", "S11", "S17"]);
  const selected = selectObservedSignals(active, "HIGH");
  const out = toRcJson(selected);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(out, null, 2));
}


/* =====================
   SOURCE: Backend_10_Reasoning Control Distribution.ts
   (verbatim from derive폴더.zip)
===================== */

/* ============================================================
   Reasoning Control Distribution + Determination (CFV Logistic Spec)
   ============================================================ */

export type Determination = "Human" | "Hybrid" | "AI";

/* ---------- CFV ---------- */

export type CFVKey =
  | "aas"
  | "ctf"
  | "rmd"
  | "rdx"
  | "eds"
  | "hi"
  | "tps_hist"
  | "ifd";

export type CFV = Record<CFVKey, number>; // 0..1 normalized


/* ---------- Model ---------- */

export interface LogisticModel {
  beta0: number;
  betas: Partial<Record<CFVKey, number>>;
  z_clip?: number;
}


/* ---------- Inputs / Outputs ---------- */

export interface RcInferenceInput {
  cfv: CFV;
  model: LogisticModel;
}

export interface RcDistributionOutput {
  rc: {
    reasoning_control_distribution: {
      Human: string;
      Hybrid: string;
      AI: string;
      final_determination: Determination;
      determination_sentence: string;
    };
  };
}


/* ---------- helpers ---------- */

function clamp01(x: number): number {
  const v = Number.isFinite(x) ? x : 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function pct(x01: number): string {
  return `${Math.round(clamp01(x01) * 100)}%`;
}

function normalize3(a: number, b: number, c: number) {
  a = clamp01(a);
  b = clamp01(b);
  c = clamp01(c);

  const s = a + b + c;
  if (s <= 0) return { a: 1, b: 0, c: 0 };

  return { a: a / s, b: b / s, c: c / s };
}

function sigmoid(z: number): number {
  const zz = Number.isFinite(z) ? z : 0;
  const zc = Math.max(-20, Math.min(20, zz));
  return 1 / (1 + Math.exp(-zc));
}


/* ============================================================
   Determination Sentence
   ============================================================ */

function getDeterminationSentence(det: Determination): string {
  switch (det) {
    case "Human":
      return "The combined signal profile supports classification as human-controlled reasoning.";

    case "Hybrid":
      return "The combined signal profile indicates mixed control dynamics across structural decision boundaries, consistent with hybrid reasoning control.";

    case "AI":
      return "The combined signal profile supports classification as AI-assisted or AI-dominant reasoning control across structural decision boundaries.";

    default:
      return "";
  }
}


/* ============================================================
   Thresholds
   ============================================================ */

const TH = {
  rdx_low: 0.40,
  hi_mid: 0.55,
  aas_human_like: 0.60,
  eds_ai_like: 0.60,
} as const;


/* ============================================================
   Logistic probability
   ============================================================ */

export function computePHumanFromCFV(
  cfv: CFV,
  model: LogisticModel
): number {

  const zClip = Number.isFinite(model.z_clip)
    ? (model.z_clip as number)
    : 20;

  const betas = model.betas || {};
  let z = Number.isFinite(model.beta0) ? model.beta0 : 0;

  const keys: CFVKey[] = [
    "aas",
    "ctf",
    "rmd",
    "rdx",
    "eds",
    "hi",
    "tps_hist",
    "ifd",
  ];

  for (const k of keys) {
    const b = Number.isFinite(betas[k] as number)
      ? (betas[k] as number)
      : 0;

    const f = clamp01(cfv[k]);
    z += b * f;
  }

  const zc = Math.max(-zClip, Math.min(zClip, z));

  return clamp01(sigmoid(zc));
}


/* ============================================================
   Determination rule
   ============================================================ */

export function determineLabelFromProbs(
  cfv: CFV,
  pHuman01: number
): Determination {

  const pH = clamp01(pHuman01);
  const pA = clamp01(1 - pH);

  let band: Determination;

  if (pH >= 0.75) band = "Human";
  else if (pH >= 0.45) band = "Hybrid";
  else band = "AI";

  if (band === "Hybrid") {
    const hybridCond =
      pH >= 0.35 &&
      pA >= 0.35 &&
      clamp01(cfv.rdx) < TH.rdx_low &&
      clamp01(cfv.hi) >= TH.hi_mid &&
      clamp01(cfv.aas) >= TH.aas_human_like &&
      clamp01(cfv.eds) >= TH.eds_ai_like;

    if (!hybridCond) {
      return pH >= pA ? "Human" : "AI";
    }
  }

  return band;
}


/* ============================================================
   Distribution Builder
   ============================================================ */

export function buildReasoningControlDistribution(
  input: RcInferenceInput
): RcDistributionOutput {

  const cfv = input.cfv;

  const pH = computePHumanFromCFV(cfv, input.model);
  const pA = clamp01(1 - pH);

  const final = determineLabelFromProbs(cfv, pH);

  let human = 0;
  let hybrid = 0;
  let ai = 0;

  if (final === "Hybrid") {
    hybrid = clamp01(2 * Math.min(pH, pA));
    human = clamp01(pH - hybrid / 2);
    ai = clamp01(pA - hybrid / 2);
  }
  else if (final === "Human") {
    hybrid = clamp01(Math.min(pH, pA));
    human = clamp01(pH - hybrid);
    ai = clamp01(pA - hybrid);
  }
  else {
    hybrid = clamp01(Math.min(pH, pA));
    ai = clamp01(pA - hybrid);
    human = clamp01(pH - hybrid);
  }

  const n = normalize3(human, hybrid, ai);

  return {
    rc: {
      reasoning_control_distribution: {
        Human: pct(n.a),
        Hybrid: pct(n.b),
        AI: pct(n.c),
        final_determination: final,
        determination_sentence: getDeterminationSentence(final),
      },
    },
  };
}


/* =====================
   SOURCE: Backend_11_Structural Control Signals.ts
   (verbatim from derive폴더.zip)
===================== */

/* Structural Control Signals (Agency Indicators) v1.0
   Output: 0..1 normalized magnitudes (NOT probabilities)

   Required raw (minimum):
   - units: number

   Recommended raw for stable metrics:
   - unit_lengths?: number[]                    // per-unit length (tokens/chars/sentences)
   - per_unit?: {                                // per-unit event counts (best)
       claims?: number[]
       reasons?: number[]
       evidence?: number[]
       sub_claims?: number[]
       warrants?: number[]
       counterpoints?: number[]
       refutations?: number[]
       transitions?: number[]
       transition_ok?: number[]
       revisions?: number[]
       revision_depth?: number[]                 // depth per revision event or per unit (either is OK if consistent)
       belief_change?: number[]                  // 0/1 per unit (optional)
     }

   Also allowed (fallback totals if per-unit arrays are missing):
   - totals?: {
       claims?: number
       reasons?: number
       evidence?: number
       sub_claims?: number
       warrants?: number
       counterpoints?: number
       refutations?: number
       transitions?: number
       transition_ok?: number
       revisions?: number
       revision_depth_sum?: number
       belief_change?: number
     }
*/

export type AgencyRaw = {
  units: number;

  unit_lengths?: number[];

  per_unit?: Partial<Record<
    | "claims"
    | "reasons"
    | "evidence"
    | "sub_claims"
    | "warrants"
    | "counterpoints"
    | "refutations"
    | "transitions"
    | "transition_ok"
    | "revisions"
    | "revision_depth"
    | "belief_change",
    number[]
  >>;

  totals?: Partial<Record<
    | "claims"
    | "reasons"
    | "evidence"
    | "sub_claims"
    | "warrants"
    | "counterpoints"
    | "refutations"
    | "transitions"
    | "transition_ok"
    | "revisions"
    | "revision_depth_sum"
    | "belief_change",
    number
  >>;
};

export type AgencyIndicators = {
  structural_variance: number;   // 0..1
  human_rhythm_index: number;    // 0..1
  transition_flow: number;       // 0..1
  revision_depth: number;        // 0..1
};

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function safeNum(x: unknown, fallback = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeDiv(n: number, d: number): number {
  return d > 0 ? n / d : 0;
}

function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += safeNum(v, 0);
  return s;
}

function mean(arr: number[]): number {
  return arr.length ? sum(arr) / arr.length : 0;
}

function std(arr: number[]): number {
  const n = arr.length;
  if (n < 2) return 0;
  const m = mean(arr);
  let ss = 0;
  for (const v of arr) {
    const dv = safeNum(v, 0) - m;
    ss += dv * dv;
  }
  return Math.sqrt(ss / (n - 1));
}

function cv(arr: number[]): number {
  const m = mean(arr);
  if (m <= 0) return 0;
  return std(arr) / m;
}

function diffsSortedIndices(indices: number[]): number[] {
  if (indices.length < 2) return [];
  const xs = [...indices].map(x => Math.floor(safeNum(x, 0))).filter(x => x >= 0).sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1]);
  return out;
}

function eventIndicesFromPerUnit(perUnit?: number[]): number[] {
  if (!perUnit || perUnit.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < perUnit.length; i++) {
    const v = safeNum(perUnit[i], 0);
    if (v > 0) out.push(i);
  }
  return out;
}

/* K segmentation rule:
   K = clip(round(sqrt(units)), 3, 8), but if units < 6 then K = 3
*/
function chooseK(units: number): number {
  const u = Math.max(1, Math.floor(safeNum(units, 1)));
  if (u < 6) return 3;
  const k = Math.round(Math.sqrt(u));
  return Math.min(8, Math.max(3, k));
}

function segmentRanges(units: number, K: number): Array<{ start: number; end: number; len: number }> {
  const u = Math.max(1, Math.floor(units));
  const k = Math.max(1, Math.floor(K));
  const ranges: Array<{ start: number; end: number; len: number }> = [];
  for (let i = 0; i < k; i++) {
    const start = Math.floor((i * u) / k);
    const end = Math.floor(((i + 1) * u) / k);
    const len = Math.max(0, end - start);
    ranges.push({ start, end, len });
  }
  return ranges;
}

function sliceSum(arr: number[] | undefined, start: number, end: number): number {
  if (!arr || arr.length === 0) return 0;
  const s = Math.max(0, start);
  const e = Math.min(arr.length, Math.max(s, end));
  let out = 0;
  for (let i = s; i < e; i++) out += safeNum(arr[i], 0);
  return out;
}

function l2norm(vec: number[]): number {
  let ss = 0;
  for (const v of vec) {
    const x = safeNum(v, 0);
    ss += x * x;
  }
  return Math.sqrt(ss);
}

function l2dist(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  let ss = 0;
  for (let i = 0; i < n; i++) {
    const dv = safeNum(a[i], 0) - safeNum(b[i], 0);
    ss += dv * dv;
  }
  return Math.sqrt(ss);
}

/* ---------- Indicator 1: Structural variance ----------

   Uses per-unit arrays if available.
   If per-unit arrays are missing, returns 0 (cannot measure cross-boundary restructuring reliably).

   Spec:
   - Split document into K segments by unit index
   - Build segment structure vector s_k with per-unit normalized ratios
   - SV_raw = mean_k ||s_k - s_bar||_2
   - structural_variance = min(1, SV_raw / SV_MAX)

   Default SV_MAX = 0.35 (v1.0)
*/
function computeStructuralVariance(raw: AgencyRaw, SV_MAX = 0.35): number {
  const units = Math.max(1, Math.floor(safeNum(raw.units, 1)));
  const K = chooseK(units);
  const ranges = segmentRanges(units, K);

  const pu = raw.per_unit || {};
  const keys: Array<keyof NonNullable<AgencyRaw["per_unit"]>> = [
    "claims",
    "reasons",
    "evidence",
    "sub_claims",
    "warrants",
    "counterpoints",
    "refutations",
    "transitions",
  ];

  const hasAnyPerUnit = keys.some(k => Array.isArray(pu[k]) && (pu[k] as number[]).length > 0);
  if (!hasAnyPerUnit) return 0;

  const segVecs: number[][] = [];
  for (const rg of ranges) {
    const uSeg = Math.max(1, rg.len);
    const vec: number[] = [];
    for (const k of keys) {
      const v = sliceSum(pu[k] as number[] | undefined, rg.start, rg.end);
      vec.push(v / uSeg);
    }
    segVecs.push(vec);
  }

  // mean vector
  const dim = segVecs[0]?.length || 0;
  const sBar = new Array(dim).fill(0);
  for (const v of segVecs) {
    for (let j = 0; j < dim; j++) sBar[j] += safeNum(v[j], 0);
  }
  for (let j = 0; j < dim; j++) sBar[j] = safeDiv(sBar[j], segVecs.length);

  // mean L2 distance to mean vector
  let acc = 0;
  for (const v of segVecs) acc += l2dist(v, sBar);
  const SV_raw = safeDiv(acc, segVecs.length);

  return clamp01(safeDiv(SV_raw, SV_MAX));
}

/* ---------- Indicator 2: Human rhythm index ----------

   Spec:
   - Build interval sequences and compute CV
   - Combine available CVs and normalize by CV_REF

   Default: CV_REF = 0.6
   Weights: len 0.6, transition 0.2, revision 0.2 (v1.0)
*/
function computeHumanRhythmIndex(raw: AgencyRaw, CV_REF = 0.6): number {
  const cvs: Array<{ v: number; w: number }> = [];

  if (raw.unit_lengths && raw.unit_lengths.length >= 2) {
    cvs.push({ v: cv(raw.unit_lengths.map(x => Math.max(0, safeNum(x, 0)))), w: 0.6 });
  }

  const pu = raw.per_unit || {};
  const tIdx = eventIndicesFromPerUnit(pu.transitions as number[] | undefined);
  const rIdx = eventIndicesFromPerUnit(pu.revisions as number[] | undefined);

  const tDiffs = diffsSortedIndices(tIdx);
  if (tDiffs.length >= 2) cvs.push({ v: cv(tDiffs), w: 0.2 });

  const rDiffs = diffsSortedIndices(rIdx);
  if (rDiffs.length >= 2) cvs.push({ v: cv(rDiffs), w: 0.2 });

  if (cvs.length === 0) return 0;

  let num = 0;
  let den = 0;
  for (const { v, w } of cvs) {
    num += safeNum(v, 0) * w;
    den += w;
  }
  const combined = den > 0 ? num / den : 0;

  return clamp01(safeDiv(combined, CV_REF));
}

/* ---------- Indicator 3: Transition flow ----------

   Spec:
   transition_flow = (valid / total) * log(1 + avg_chain_length)
   Then clip 0..1

   avg_chain_length:
   - If per-unit transitions exists: compute mean length of consecutive transition runs
   - Else fallback to 1.0
*/
function computeAvgChainLengthFromPerUnitTransitions(perUnitTransitions?: number[]): number {
  if (!perUnitTransitions || perUnitTransitions.length === 0) return 1;
  const xs = perUnitTransitions.map(v => (safeNum(v, 0) > 0 ? 1 : 0));
  let runs: number[] = [];
  let cur = 0;
  for (const x of xs) {
    if (x === 1) cur += 1;
    else if (cur > 0) {
      runs.push(cur);
      cur = 0;
    }
  }
  if (cur > 0) runs.push(cur);
  return runs.length ? mean(runs) : 1;
}

function computeTransitionFlow(raw: AgencyRaw): number {
  const totals = raw.totals || {};
  const pu = raw.per_unit || {};

  const totalTransitions =
    (Array.isArray(pu.transitions) ? sum(pu.transitions as number[]) : undefined) ??
    safeNum(totals.transitions, 0);

  const validTransitions =
    (Array.isArray(pu.transition_ok) ? sum(pu.transition_ok as number[]) : undefined) ??
    safeNum(totals.transition_ok, 0);

  const ratio = safeDiv(validTransitions, Math.max(1, totalTransitions));

  const avgChain =
    computeAvgChainLengthFromPerUnitTransitions(pu.transitions as number[] | undefined);

  const tf = ratio * Math.log(1 + Math.max(0, avgChain));
  return clamp01(tf);
}

/* ---------- Indicator 4: Revision depth ----------

   Spec:
   revision_depth = min(1, revision_depth_sum / D_MAX)

   Default: D_MAX = 3.0 (v1.0)
   If revision_depth_sum missing but revisions exists: fallback proxy based on log scaling.
*/
function computeRevisionDepth(raw: AgencyRaw, D_MAX = 3.0, R_REF = 12): number {
  const totals = raw.totals || {};
  const pu = raw.per_unit || {};

  // Prefer explicit depth sum
  let depthSum =
    (Array.isArray(pu.revision_depth) ? sum(pu.revision_depth as number[]) : undefined) ??
    safeNum(totals.revision_depth_sum, NaN);

  if (Number.isFinite(depthSum)) {
    return clamp01(safeDiv(depthSum, D_MAX));
  }

  // Fallback: use revision count proxy
  const revisions =
    (Array.isArray(pu.revisions) ? sum(pu.revisions as number[]) : undefined) ??
    safeNum(totals.revisions, 0);

  const proxy = safeDiv(Math.log(1 + Math.max(0, revisions)), Math.log(1 + Math.max(1, R_REF)));
  return clamp01(proxy);
}

/* ---------- Public API ---------- */

export function computeAgencyIndicators(raw: AgencyRaw): AgencyIndicators {
  const structural_variance = computeStructuralVariance(raw);
  const human_rhythm_index = computeHumanRhythmIndex(raw);
  const transition_flow = computeTransitionFlow(raw);
  const revision_depth = computeRevisionDepth(raw);

  return {
    structural_variance,
    human_rhythm_index,
    transition_flow,
    revision_depth,
  };
}

/* ---------- Export JSON wrapper (rc format) ---------- */

export type StructuralControlSignalsRcJson = {
  rc: {
    structural_control_signals: AgencyIndicators;
  };
};

/**
 * computeAgencyIndicatorsRc
 * - Returns rc-wrapped JSON:
 *   {
 *     "rc": {
 *       "structural_control_signals": {
 *         "structural_variance": ...,
 *         "human_rhythm_index": ...,
 *         "transition_flow": ...,
 *         "revision_depth": ...
 *       }
 *     }
 *   }
 */
export function computeAgencyIndicatorsRc(raw: AgencyRaw): StructuralControlSignalsRcJson {
  return {
    rc: {
      structural_control_signals: computeAgencyIndicators(raw),
    },
  };
}

export type RawFeaturesPayload = {
  raw_features: {
    layer_0: {
      units: number;

      // arrays for stable metrics (length must equal units when present)
      unit_lengths?: number[];
      per_unit?: {
        transitions?: number[];
        revisions?: number[];

        // optional expansions (enable richer structural variance and rhythm features)
        claims?: number[];
        reasons?: number[];
        evidence?: number[];
        sub_claims?: number[];
        warrants?: number[];
        counterpoints?: number[];
        refutations?: number[];
        transition_ok?: number[];
        revision_depth?: number[];
        belief_change?: number[];
      };

      // totals (keep)
      claims: number;
      reasons: number;
      evidence: number;
    };
    layer_1: {
      sub_claims: number;
      warrants: number;
      counterpoints: number;
      refutations: number;
      structure_type: string | null;
    };
    layer_2: {
      transitions: number;
      transition_types: string[];
      transition_ok: number;
      revisions: number;
      revision_depth_sum: number;
      belief_change: boolean;
    };
    layer_3: {
      intent_markers: number;
      drift_segments: number;
      hedges: number;
      loops: number;
      self_regulation_signals: number;
    };
    evidence_types: Record<string, number>;
    adjacency_links: number;
    backend_reserved: {
      kpf_sim: number | null;
      tps_h: number | null;
    };
  };
};

export type RcStructuralControlSignalsJson = {
  rc: {
    structural_control_signals: AgencyIndicators;
  };
};

function toAgencyRawFromRawFeatures(payload: RawFeaturesPayload): AgencyRaw {
  const rf = payload?.raw_features;

  const units = Math.max(0, safeNum(rf?.layer_0?.units, 0));

  // arrays (only accept if length === units)
  const unit_lengths_raw = rf?.layer_0?.unit_lengths;
  const unit_lengths =
    Array.isArray(unit_lengths_raw) && unit_lengths_raw.length === units
      ? unit_lengths_raw.map((x) => Math.max(0, Math.floor(safeNum(x, 0))))
      : undefined;

  const pu0 = rf?.layer_0?.per_unit;

  const arrOrUndef = (a: unknown): number[] | undefined => {
    if (!Array.isArray(a)) return undefined;
    if (a.length !== units) return undefined;
    return a.map((x) => Math.max(0, safeNum(x, 0)));
  };

  const per_unit: AgencyRaw["per_unit"] = {
    transitions: arrOrUndef(pu0?.transitions),
    revisions: arrOrUndef(pu0?.revisions),

    claims: arrOrUndef(pu0?.claims),
    reasons: arrOrUndef(pu0?.reasons),
    evidence: arrOrUndef(pu0?.evidence),
    sub_claims: arrOrUndef(pu0?.sub_claims),
    warrants: arrOrUndef(pu0?.warrants),
    counterpoints: arrOrUndef(pu0?.counterpoints),
    refutations: arrOrUndef(pu0?.refutations),
    transition_ok: arrOrUndef(pu0?.transition_ok),
    revision_depth: arrOrUndef(pu0?.revision_depth),
    belief_change: arrOrUndef(pu0?.belief_change),
  };

  const totals: NonNullable<AgencyRaw["totals"]> = {
    claims: Math.max(0, safeNum(rf?.layer_0?.claims, 0)),
    reasons: Math.max(0, safeNum(rf?.layer_0?.reasons, 0)),
    evidence: Math.max(0, safeNum(rf?.layer_0?.evidence, 0)),

    sub_claims: Math.max(0, safeNum(rf?.layer_1?.sub_claims, 0)),
    warrants: Math.max(0, safeNum(rf?.layer_1?.warrants, 0)),
    counterpoints: Math.max(0, safeNum(rf?.layer_1?.counterpoints, 0)),
    refutations: Math.max(0, safeNum(rf?.layer_1?.refutations, 0)),

    transitions: Math.max(0, safeNum(rf?.layer_2?.transitions, 0)),
    transition_ok: Math.max(0, safeNum(rf?.layer_2?.transition_ok, 0)),
    revisions: Math.max(0, safeNum(rf?.layer_2?.revisions, 0)),
    revision_depth_sum: Math.max(0, safeNum(rf?.layer_2?.revision_depth_sum, 0)),

    belief_change: rf?.layer_2?.belief_change ? 1 : 0,
  };

  const hasAnyPerUnit =
    per_unit && Object.values(per_unit).some((v) => Array.isArray(v) && v.length > 0);

  return {
    units,
    unit_lengths,
    per_unit: hasAnyPerUnit ? per_unit : undefined,
    totals,
  };
}


/**
 * Final API (your contract):
 * - Input: RawFeaturesPayload
 * - Output:
 *   { "rc": { "structural_control_signals": { ...4 indicators... } } }
 */
export function computeStructuralControlSignalsRc(payload: RawFeaturesPayload): RcStructuralControlSignalsJson {
  const agencyRaw = toAgencyRawFromRawFeatures(payload);
  const indicators = computeAgencyIndicators(agencyRaw);
  return {
    rc: {
      structural_control_signals: indicators,
    },
  };
}


/* =====================
   deriveRc orchestrator
===================== */
export type DeriveRcInput = any;

export function deriveRc(input: DeriveRcInput): Record<string, any> {
  const ai = (input && typeof input === "object" && "analysis_input" in input)
    ? (input as any).analysis_input
    : input;

  const raw = ai?.raw_features ?? ai?.raw ?? ai?.rawFeatures ?? ai?.raw_features_v1 ?? ai?.raw_features_v2;

  const rcSummary = raw ? computeRCFromRaw(raw as any) : { rc: {} };

  // Observed Structural Signals library + selection (if rcSummary has signals)
  // buildSignalLibrary returns library; computeRCFromRaw may already output rc.observed_structural_signals.
  const lib = buildSignalLibraryV1_S1toS18();
  const observed = (rcSummary as any)?.rc?.observed_structural_signals;
  const observedBlock = observed ? { rc: { observed_structural_signals: observed, observed_structural_signals_library: lib } } : { rc: { observed_structural_signals_library: lib } };

  // Reasoning Control Distribution (p_human etc) from CFV if present
  const cfv = ai?.cff?.cfv ?? ai?.cff?.indicators ?? ai?.cff?.indicators_vector;
  let dist: any = { rc: {} };
  try {
    if (cfv) dist = computePHumanFromCFV(cfv as any);
  } catch { dist = { rc: {} }; }

  // Agency indicators (structural_control_signals)
  const agency = raw ? computeAgencyIndicators(raw as any) : { rc: { structural_control_signals: {} } };

  return deepMergeAll(rcSummary, observedBlock, dist, agency);

  function deepMergeAll(...objs: any[]): any {
    const out: any = {};
    for (const o of objs) deepMergeInto(out, o);
    return out;
  }
  function deepMergeInto(target: any, src: any) {
    if (!src || typeof src !== "object") return;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const tv = target[k];
      if (tv && typeof tv === "object" && sv && typeof sv === "object" && !Array.isArray(tv) && !Array.isArray(sv)) {
        deepMergeInto(tv, sv);
      } else {
        target[k] = sv;
      }
    }
  }
}
