
/* =====================
   SOURCE: Backend_5_Observed Reasoning Patterns.ts
   (verbatim from derive폴더.zip)
===================== */

/* =========================
   Observed Reasoning Patterns (Backend Fixed Spec)
   - 8 profiles: RE, IE, EW, AR, SI, RR, HE, MD
   - Always attach label + description from backend constants
   - HE/MD formulas included, but require KPF or TPS to produce non-null score
========================= */

export type ProfileCode = "RE" | "IE" | "EW" | "AR" | "SI" | "RR" | "HE" | "MD";

export interface ProfileMeta {
  code: ProfileCode;
  label: string;
  description: string;
}

export const OBSERVED_PROFILE_META: Record<ProfileCode, ProfileMeta> = {
  RE: {
    code: "RE",
    label: "Reflective Explorer",
    description:
      "Reflective Explorer shows active self-revision and exploratory restructuring during reasoning. Thought progresses through reflection, reassessment, and adaptive refinement.",
  },
  IE: {
    code: "IE",
    label: "Intuitive Explorer",
    description:
      "Intuitive Explorer advances reasoning through associative leaps and conceptual exploration. Structure emerges gradually rather than being predefined.",
  },
  EW: {
    code: "EW",
    label: "Evidence Weaver",
    description:
      "Evidence Weaver emphasizes linking claims with supporting material. Reasoning strength lies in evidence connectivity rather than abstract inference.",
  },
  AR: {
    code: "AR",
    label: "Analytical Reasoner",
    description:
      "Analytical Reasoner breaks a problem into explicit components and evaluates them through stepwise logic. Reasoning emphasizes clear structure, rule-based validation, and consistency across claims and supporting points.",
  },
  SI: {
    code: "SI",
    label: "Strategic Integrator",
    description:
      "Strategic Integrator aligns multiple reasoning strands into a unified direction. Decision-making reflects coordination and long-term framing.",
  },
  RR: {
    code: "RR",
    label: "Reflective Regulator",
    description:
      "Reflective Regulator actively monitors and controls reasoning boundaries. This type prioritizes balance, restraint, and intentional stopping points.",
  },
  HE: {
    code: "HE",
    label: "Human Expressionist",
    description:
      "Human Expressionist expresses reasoning through narrative and contextual meaning. Communication clarity and human resonance are central.",
  },
  MD: {
    code: "MD",
    label: "Machine-Dominant",
    description:
      "Machine-Dominant pattern reflects heavy dependence on automated or system-driven reasoning flow. Human agency signals are limited.",
  },
};

export interface ObservedProfileScore extends ProfileMeta {
  score: number | null; // 0..1, null when not computable
  pass_rule: boolean; // threshold pass (or other rule pass)
  reason?: string[]; // optional diagnostics (backend only)
}

export interface ObservedPatternsOutV2 {
  layer: "Cognitive Pattern Profile Layer";
  selection_rule: {
    threshold: number; // default 0.62
    min_count: number; // default 2
    max_count: number; // default 3
  };
  all_profiles: ObservedProfileScore[]; // always 8 entries, fixed order
  profiles: ObservedProfileScore[]; // selected topK (2..3)
}

/** Minimal options for observed patterns */
export interface ObservedOptions {
  observed_threshold?: number; // default 0.62
  observed_min?: number; // default 2
  observed_max?: number; // default 3
}

/* ---------- helpers you already have ---------- */
function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

function weightedAvg(terms: Array<{ v: number | null; w: number }>): number | null {
  let W = 0;
  let S = 0;
  for (const t of terms) {
    if (t.v == null) continue;
    W += t.w;
    S += t.v * t.w;
  }
  if (W <= 0) return null;
  return S / W;
}

/* ---------- core axes input from your computeCore ---------- */
export interface CoreAxes {
  AAS: number | null;
  CTF: number | null;
  RMD: number | null;
  RDX: number | null;
  EDS: number | null;
  IFD: number | null;
  KPF: number | null; // KPF-Sim (0..1)
  TPS: number | null; // TPS-H (0..1)
  Analyticity: number | null; // (AAS+EDS)/2 with missing-safe avg in your core
  Flow: number | null; // (CTF+RMD)/2 with missing-safe avg in your core
  MetacogRaw: number | null; // (RDX+IFD)/2 with missing-safe avg in your core
}

/* =========================
   8-profile scoring (fixed formulas)
   - HE/MD included
   - HE/MD require KPF or TPS to compute
========================= */
function scoreRE(core: CoreAxes): number | null {
  return weightedAvg([
    { v: core.RDX, w: 0.45 },
    { v: core.CTF, w: 0.30 },
    { v: core.RMD, w: 0.25 },
  ]);
}

function scoreIE(core: CoreAxes): number | null {
  if (core.Flow == null || core.Analyticity == null) return null;
  return clamp01(0.60 * core.Flow + 0.40 * (1 - core.Analyticity));
}

function scoreEW(core: CoreAxes): number | null {
  return weightedAvg([
    { v: core.EDS, w: 0.55 },
    { v: core.AAS, w: 0.45 },
  ]);
}

function scoreAR(core: CoreAxes): number | null {
  // 0.65*AAS + 0.35*EDS - 0.20*CTF, clamp 0..1
  const base = weightedAvg([
    { v: core.AAS, w: 0.65 },
    { v: core.EDS, w: 0.35 },
  ]);
  if (base == null && core.CTF == null) return null;
  const out = (base ?? 0) - (core.CTF == null ? 0 : 0.20 * core.CTF);
  return clamp01(out);
}

function scoreSI(core: CoreAxes): number | null {
  if (core.Analyticity == null || core.Flow == null || core.MetacogRaw == null) return null;
  return clamp01(Math.min(core.Analyticity, core.Flow, core.MetacogRaw));
}

function scoreRR(core: CoreAxes): number | null {
  // 0.60*RDX + 0.40*(1-IFD)
  return weightedAvg([
    { v: core.RDX, w: 0.60 },
    { v: core.IFD == null ? null : 1 - core.IFD, w: 0.40 },
  ]);
}

function authenticity(core: CoreAxes): number | null {
  const { KPF, TPS } = core;
  // Authenticity = avg(1-KPF, TPS) when both
  // = 1-KPF when KPF only
  // = TPS when TPS only
  if (KPF == null && TPS == null) return null;
  if (KPF != null && TPS != null) return (1 - KPF + TPS) / 2;
  if (KPF != null) return 1 - KPF;
  return TPS; // TPS only
}

function machineScore(core: CoreAxes): number | null {
  const { KPF, TPS } = core;
  // MachineScore = avg(KPF, 1-TPS) when both
  // = KPF when KPF only
  // = 1-TPS when TPS only
  if (KPF == null && TPS == null) return null;
  if (KPF != null && TPS != null) return (KPF + (1 - TPS)) / 2;
  if (KPF != null) return KPF;
  return 1 - (TPS as number);
}

function scoreHE(core: CoreAxes): number | null {
  // Score_HE = 0.55*Authenticity + 0.25*CTF + 0.20*RMD
  const A = authenticity(core);
  if (A == null) return null; // requires KPF or TPS
  return clamp01(0.55 * A + 0.25 * (core.CTF ?? 0) + 0.20 * (core.RMD ?? 0));
}

function scoreMD(core: CoreAxes): number | null {
  // For Observed Patterns we can just use MachineScore as score (0..1)
  // The "score" here is not a final determination, only observed signal.
  const M = machineScore(core);
  if (M == null) return null; // requires KPF or TPS
  return clamp01(M);
}

/* =========================
   Pass rules (fixed)
   - Base threshold for selection: >= TH
   - Here we implement pass_rule as:
     - score != null AND score >= TH
========================= */
function passRule(
  code: ProfileCode,
  core: CoreAxes,
  score: number | null,
  TH: number
): { pass: boolean; reason?: string[] } {
  const reason: string[] = [];

  // Not computable
  if (score == null) {
    if (code === "HE" || code === "MD") {
      if (core.KPF == null && core.TPS == null) {
        reason.push("KPF-Sim and TPS-H are not available, score is not computable");
      } else {
        reason.push("KPF-Sim or TPS-H available, but required inputs for score are missing");
      }
    } else {
      reason.push("Required indicators missing, score is not computable");
    }
    return { pass: false, reason };
  }

  const pass = score >= TH;
  if (!pass) reason.push(`score < threshold (${TH})`);

  return { pass, reason: reason.length ? reason : undefined };
}

/* =========================
   Main: compute observed patterns with 8 profiles + meta
========================= */
export function computeObservedPatternsV2(core: CoreAxes, opts?: ObservedOptions): ObservedPatternsOutV2 {
  const TH = opts?.observed_threshold ?? 0.62;
  const MIN = opts?.observed_min ?? 2;
  const MAX = opts?.observed_max ?? 3;

  // Fixed order for stability (backend deterministic)
  const order: ProfileCode[] = ["RE", "IE", "EW", "AR", "SI", "RR", "HE", "MD"];

  const rawScores: Record<ProfileCode, number | null> = {
    RE: scoreRE(core),
    IE: scoreIE(core),
    EW: scoreEW(core),
    AR: scoreAR(core),
    SI: scoreSI(core),
    RR: scoreRR(core),
    HE: scoreHE(core),
    MD: scoreMD(core),
  };

  const all_profiles: ObservedProfileScore[] = order.map((code) => {
    const meta = OBSERVED_PROFILE_META[code];
    const s0 = rawScores[code];
    const s = s0 == null ? null : clamp01(s0);
    const pr = passRule(code, core, s, TH);
    return {
      ...meta,
      score: s,
      pass_rule: pr.pass,
      reason: pr.reason,
    };
  });

  // Selection pool: only computable scores (non-null)
  const pool = all_profiles
    .filter((p) => p.score != null)
    .slice()
    .sort((a, b) => (b.score as number) - (a.score as number));

  // Threshold-first selection (spec-aligned):
  // 1) Collect all computable profiles with score >= TH
  // 2) If too many, keep top MAX by score
  // 3) If too few, fill up to MIN by top score from the computable pool
  let picked = pool.filter((p) => (p.score as number) >= TH);

  if (picked.length > MAX) {
    picked = picked.slice(0, MAX);
  }

  if (picked.length < MIN) {
    picked = pool.slice(0, Math.min(MIN, pool.length));
  }

  return {
    layer: "Cognitive Pattern Profile Layer",
    selection_rule: { threshold: TH, min_count: MIN, max_count: MAX },
    all_profiles,
    profiles: picked,
  };
}

export interface CffPatternOut {
  cff: {
    pattern: {
      primary_label: string;
      secondary_label: string;
      definition: {
        primary: string;
        secondary: string;
      };
    };
  };
}

/**
 * Build the compact CFF pattern output used by the report layer.
 *
 * Selection rule:
 * - Uses computeObservedPatternsV2(core, opts).profiles
 * - Primary = highest-score selected profile
 * - Secondary = second-highest selected profile
 *
 * Safety:
 * - If selection list is shorter than 2 (should not happen with defaults),
 *   fall back to the highest-score computable profiles from all_profiles.
 */
export function computeCffPatternOut(core: CoreAxes, opts?: ObservedOptions): CffPatternOut {
  const observed = computeObservedPatternsV2(core, opts);

  const selected = observed.profiles
    .filter((p) => p.score != null)
    .slice()
    .sort((a, b) => (b.score as number) - (a.score as number));

  const fallback = observed.all_profiles
    .filter((p) => p.score != null)
    .slice()
    .sort((a, b) => (b.score as number) - (a.score as number));

  const list = selected.length >= 2 ? selected : fallback;

  const primary = list[0] ?? OBSERVED_PROFILE_META.RE;
  const secondary = list[1] ?? OBSERVED_PROFILE_META.EW;

  return {
    cff: {
      pattern: {
        primary_label: primary.label,
        secondary_label: secondary.label,
        definition: {
          primary: primary.description,
          secondary: secondary.description,
        },
      },
    },
  };
}


/* =========================
   CFF output adapter (for UI/result.json)
   - Converts observed pattern selection into the JSON shape you requested:

   {
     "cff": {
       "pattern": {
         "primary_label": "...",
         "secondary_label": "...",
         "definition": { "primary": "...", "secondary": "..." },
       }
     }
   }
========================= */

/* =====================
   SOURCE: Backend_7_CFF.ts
   (verbatim from derive폴더.zip)
===================== */

// lib/server/cff_v1.ts
// CFF v1.0 (정식 고정안) - 수식 변형 금지
// 원칙:
// 1) GPT는 Raw Feature만 반환
// 2) 계산은 100% 백엔드(여기)
// 3) 모든 점수는 0~1 정규화
// 4) clamp만 사용 (sat, entropy, adjacency_links 등 확장요소 사용 금지)

export type StructureType = "linear" | "hierarchical" | "networked";

export type RawFeaturesV1 = {
  // 공통 전제
  units: number;   // U
  claims: number;  // C
  reasons: number; // R
  evidence: number;// E

  // 1) AAS
  sub_claims?: number;
  warrants: number;
  structure_type?: StructureType;

  // 2) CTF
  transitions: number;
  transition_ok: number;

  // 3) RMD
  hedges: number;
  loops: number;

  // 4) RDX
  revisions: number;
  revision_depth_sum: number;
  belief_change?: boolean;

  // 5) EDS
  evidence_types?: string[]; // set 취급

  // 6) IFD
  intent_markers: number;
  drift_segments?: number;

  // backend_only (MVP 결측 가능)
  kpf_sim?: number | null;
  tps_h?: number | null;
};

export type CFF6 = {
  AAS: number;
  CTF: number;
  RMD: number;
  RDX: number;
  EDS: number;
  IFD: number;
};

export type CFF8 = CFF6 & {
  // 내부 계산에서는 기존처럼 숫자(0..1)를 유지
  // (단, UI 출력에서는 입력이 없으면 N/A로 보여준다)
  KPF_SIM: number;
  TPS_H: number;
};

function safeDiv(a: number, b: number): number {
  return a / Math.max(1, b);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function structureWeight(st?: StructureType): number {
  // v1.0 문서 고정값
  switch (st ?? "linear") {
    case "linear":
      return 0.3;
    case "hierarchical":
      return 0.6;
    case "networked":
      return 1.0;
    default:
      return 0.3;
  }
}

function naToMid01(x: number | null | undefined): number {
  // 내부 계산용: 결측이면 0.5(중립)로 유지
  // (UI 출력에서 "N/A" 처리할지 여부는 어댑터에서 결정)
  return typeof x === "number" && Number.isFinite(x) ? clamp01(x) : 0.5;
}

/**
 * computeCFF6_v1
 * - 네 문서 v1.0 수식 그대로
 * - 입력 안전화(음수 방지, units 최소 1)만 수행
 */
export function computeCFF6_v1(raw: RawFeaturesV1): CFF6 {
  const U = Math.max(1, Math.floor(raw.units || 1));
  const C = Math.max(0, raw.claims || 0);
  const R = Math.max(0, raw.reasons || 0);
  const E = Math.max(0, raw.evidence || 0);

  const sub = Math.max(0, raw.sub_claims || 0);
  const W = Math.max(0, raw.warrants || 0);
  const st = raw.structure_type ?? "linear";

  const T = Math.max(0, raw.transitions || 0);
  const Tok = Math.max(0, raw.transition_ok || 0);

  const hedges = Math.max(0, raw.hedges || 0);
  const loops = Math.max(0, raw.loops || 0);

  const rev = Math.max(0, raw.revisions || 0);
  const revDepthSum = Math.max(0, raw.revision_depth_sum || 0);
  const beliefChange = !!raw.belief_change;

  const intentMarkers = Math.max(0, raw.intent_markers || 0);
  const driftSeg = Math.max(0, raw.drift_segments || 0);

  const evTypes = raw.evidence_types ? new Set(raw.evidence_types) : new Set<string>();

  // 1) AAS – Argument Architecture Style (문서 수식 그대로)
  const hierarchy_ratio = safeDiv(sub, C);
  const warrant_ratio = safeDiv(W, C);
  const structure_weight = structureWeight(st);

  const AAS_raw =
    (0.4 * hierarchy_ratio) +
    (0.4 * warrant_ratio) +
    (0.2 * structure_weight);

  const AAS = clamp01(AAS_raw);

  // 2) CTF – Cognitive Transition Flow (문서 수식 그대로)
  const transition_density = safeDiv(T, U);
  const valid_transition_ratio = safeDiv(Tok, T);

  const CTF_raw =
    (0.6 * transition_density) +
    (0.4 * valid_transition_ratio);

  const CTF = clamp01(CTF_raw);

  // 3) RMD – Reasoning Momentum Delta (문서 수식 그대로)
  const progress_rate = safeDiv(R, U);
  const friction_rate = safeDiv((hedges + loops), U);

  const RMD_raw = progress_rate - friction_rate;
  const RMD = clamp01(0.5 + RMD_raw);

  // 4) RDX – Revision Depth Index (문서 수식 그대로)
  const depth_avg = safeDiv(revDepthSum, rev);
  const belief_bonus = beliefChange ? 0.2 : 0.0;

  const RDX_raw = (0.7 * depth_avg) + belief_bonus;
  const RDX = clamp01(RDX_raw);

  // 5) EDS – Evidence Diversity Score (문서 수식 그대로)
  const type_diversity = safeDiv(evTypes.size, 4); // 경험/데이터/예시/원리
  const evidence_density = safeDiv(E, C);

  const EDS_raw =
    (0.6 * type_diversity) +
    (0.4 * evidence_density);

  const EDS = clamp01(EDS_raw);

  // 6) IFD – Intent Friction Delta (문서 수식 그대로)
  const intent_strength = intentMarkers > 0 ? 1.0 : 0.5;
  const drift_rate = safeDiv(driftSeg, U);

  const IFD_raw = intent_strength - drift_rate;
  const IFD = clamp01(IFD_raw);

  return { AAS, CTF, RMD, RDX, EDS, IFD };
}

export function computeCFF8_v1(raw: RawFeaturesV1): CFF8 {
  const base = computeCFF6_v1(raw);
  return {
    ...base,
    KPF_SIM: naToMid01(raw.kpf_sim),
    TPS_H: naToMid01(raw.tps_h),
  };
}

/* ======================================================
   UI Output Adapter (RADAR VERSION)
   - labels + values 배열 구조
   - KPF-Sim, TPS-H 는 입력이 없으면 "N/A" 출력
   - JSON 키는 하이픈 포함: "KPF-Sim", "TPS-H"
====================================================== */

type ScoreOrNA = number | "N/A";

export type CffUiOut = {
  cff: {
    labels: string[];
    values_0to1: ScoreOrNA[];
  };
};

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function hasFinite(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function toScoreOrNA(x: number | null | undefined): ScoreOrNA {
  return hasFinite(x) ? round2(clamp01(x)) : "N/A";
}

/**
 * computeCffUiOut_v1
 * - 수식 계산은 computeCFF6_v1/computeCFF8_v1를 그대로 사용
 * - 단, KPF/TPS는 입력 결측이면 "N/A"로 출력
 * - 출력 구조는 레이더 차트 친화형(labels + values_0to1)
 */
export function computeCffUiOut_v1(raw: RawFeaturesV1): CffUiOut {
  const v6 = computeCFF6_v1(raw);

  const labels = ["AAS", "CTF", "RMD", "RDX", "EDS", "IFD", "KPF-Sim", "TPS-H"];

  const values: ScoreOrNA[] = [
    v6.AAS,
    v6.CTF,
    v6.RMD,
    v6.RDX,
    v6.EDS,
    v6.IFD,
    raw.kpf_sim,
    raw.tps_h,
  ].map(toScoreOrNA);

  return {
    cff: {
      labels,
      values_0to1: values,
    },
  };
}

/*
======================================================
결과 json (예시)
======================================================

(입력에 kpf_sim/tps_h가 없을 때)

{
  "cff": {
    "labels": ["AAS","CTF","RMD","RDX","EDS","IFD","KPF-Sim","TPS-H"],
    "values_0to1": [0.71,0.64,0.58,0.73,0.66,0.79,"N/A","N/A"]
  }
}
*/


/* =====================
   SOURCE: Backend_6_Final Determination.ts
   (verbatim from derive폴더.zip)
===================== */

/* final_determination_v1.ts
   Source: Backend_6_Final Determination.txt (converted Python -> TypeScript)

   Updated user-required JSON output (inside `cff`) must be:

   {
     "cff": {
       "final_type": {
         "label": "Ax-4. Reasoning Simulator",
         "chip_label": "Reasoning Simulator",
         "confidence": 0.81,
         "interpretation": "..."
       }
     }
   }

   Notes
   - This file keeps the original branching logic and confidence computation.
   - It changes ONLY the public output shape to match the UI/contract requirement.
   - The interpretation text is registry-driven to keep UI text stable.
*/

export type IndicatorCode =
  | "AAS"
  | "CTF"
  | "RMD"
  | "RDX"
  | "EDS"
  | "IFD"
  | "KPF-Sim"
  | "TPS-H";

export type IndicatorStatus = "Active" | "Excluded" | "Missing";

export type DetCode =
  | "T1"
  | "T2"
  | "T3"
  | "T4"
  | "T5"
  | "T6"
  | "Hx-1"
  | "Hx-2"
  | "Hx-3"
  | "Hx-4"
  | "Ax-1"
  | "Ax-2"
  | "Ax-3"
  | "Ax-4";

export type IndicatorValue = { score: number | null; status: IndicatorStatus };
export type CffInput = { indicators: Record<IndicatorCode, IndicatorValue | undefined> };

/* =========================
   Public output (UPDATED)
========================= */

export type CffFinalTypePublic = {
  label: string;
  chip_label: string;
  confidence: number; // 0..1
  interpretation: string;
};

export type CffOut = {
  cff: {
    final_type: CffFinalTypePublic;
  };
};

export const TYPE_REGISTRY: Record<DetCode, { type_name: string; type_description: string }> = {
  T1: {
    type_name: "Analytical Reasoner",
    type_description:
      "T1. Analytical Reasoner approaches problems through structured decomposition and logical sequencing. Reasoning is driven by explicit analysis, rule-based evaluation, and clear separation of components. This pattern prioritizes correctness, internal consistency, and stepwise justification.",
  },
  T2: {
    type_name: "Reflective Thinker",
    type_description:
      "T2. Reflective Thinker emphasizes self-monitoring and internal revision during reasoning. This pattern frequently revisits prior assumptions, adjusts interpretations, and refines conclusions through reflection. Reasoning quality is shaped by iterative reassessment rather than linear progression.",
  },
  T3: {
    type_name: "Intuitive Explorer",
    type_description:
      "T3. Intuitive Explorer relies on associative thinking and exploratory inference. Reasoning advances through pattern recognition, conceptual leaps, and hypothesis generation rather than explicit structure. This pattern prioritizes discovery and possibility over immediate validation.",
  },
  T4: {
    type_name: "Strategic Integrator",
    type_description:
      "T4. Strategic Integrator focuses on synthesizing multiple perspectives into a coherent direction. Reasoning involves alignment of goals, constraints, and long-term implications. This pattern emphasizes coordination, prioritization, and purposeful convergence.",
  },
  T5: {
    type_name: "Human Expressionist",
    type_description:
      "T5. Human Expressionist centers reasoning around meaning, context, and human experience. Thought is shaped by narrative coherence, emotional nuance, and communicative clarity. This pattern prioritizes expressiveness and interpretive depth over formal structure.",
  },
  T6: {
    type_name: "Machine-Dominant",
    type_description:
      "T6. Machine-Dominant pattern shows strong reliance on external systems or automated reasoning flows. Decision progression often mirrors templated logic or system-driven optimization. Human agency and self-directed revision signals remain limited.",
  },
  "Ax-1": {
    type_name: "Template Generator",
    type_description:
      "Ax-1. Template Generator produces reasoning by following predefined structural patterns. Responses are consistent and organized but show limited adaptation beyond the template. Original restructuring signals are minimal.",
  },
  "Ax-2": {
    type_name: "Evidence Synthesizer",
    type_description:
      "Ax-2. Evidence Synthesizer focuses on collecting and linking supporting information. Reasoning emphasizes aggregation and alignment of evidence rather than original inference. Conclusions emerge from evidence density rather than internal exploration.",
  },
  "Ax-3": {
    type_name: "Style Emulator",
    type_description: "Ax-3. Style Emulator mirrors linguistic and structural patterns.",
  },
  "Ax-4": {
    type_name: "Reasoning Simulator",
    type_description:
      "Ax-4. Reasoning Simulator reproduces the appearance of structured reasoning through iterative expansion and recombination. While transitions and revisions are present, they are driven by simulation rather than genuine internal intent formation.",
  },
  "Hx-1": {
    type_name: "Draft-Assist",
    type_description:
      "Hx-1. Draft-Assist Type uses AI support primarily for initial idea formation. Human control increases in later stages through revision and refinement.",
  },
  "Hx-2": {
    type_name: "Structure-Assist",
    type_description:
      "Hx-2. Structure-Assist Type relies on AI to organize and scaffold reasoning. Core ideas remain human-driven, while structural clarity is externally supported.",
  },
  "Hx-3": {
    type_name: "Evidence-Assist",
    type_description:
      "Hx-3. Evidence-Assist Type leverages AI to gather or arrange supporting material. Human reasoning determines relevance and final judgment.",
  },
  "Hx-4": {
    type_name: "Reasoning-Assist",
    type_description:
      "Hx-4. Reasoning-Assist Type involves AI participation in intermediate reasoning steps. Human oversight remains, but reasoning momentum is partially shared.",
  },
};

// Interpretation registry, UI text stable and editable.
// If a code is missing here, we fall back to a safe generic sentence.
export const INTERPRETATION_REGISTRY: Partial<Record<DetCode, string>> = {
  "Ax-4":
    "Reasoning Simulator reflects a reasoning structure that appears coherent and well-formed, while transitions and revisions are driven by simulated control patterns rather than direct intent formation.",
};

function isFiniteNumber(x: unknown): x is number {
  // Avoid Number.isFinite for older TS lib targets.
  return typeof x === "number" && isFinite(x);
}

function clamp01(x: number): number {
  if (!isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function avg(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return (a + b) / 2;
}

function getActiveScore(cff: CffInput, code: IndicatorCode, normalizeTpsH: boolean): number | null {
  const iv = cff.indicators[code];
  if (!iv) return null;
  if (iv.status !== "Active") return null;
  if (!isFiniteNumber(iv.score)) return null;

  let x = iv.score;
  if (normalizeTpsH && code === "TPS-H") {
    x = x > 1.01 ? x / 100 : x;
  }
  return clamp01(x);
}

function confFromMargin(margin: number): number {
  const base = 0.65;
  const scale = 0.7;
  const capLow = 0.55;
  const capHigh = 0.92;
  let v = base + scale * margin;
  if (v < capLow) v = capLow;
  if (v > capHigh) v = capHigh;
  return clamp01(v);
}

function round2(x: number): number {
  // UI contract prefers a stable human-readable confidence like 0.81
  return Math.round(x * 100) / 100;
}

export function computeFinalDeterminationCff(
  cff: CffInput,
  opts?: {
    t2_mode?: "Regulation" | "MetacogRaw";
    conservative_lock_ai_hybrid?: boolean;
  }
): CffOut {
  const t2Mode = opts?.t2_mode ?? "Regulation";
  const conservativeLock = opts?.conservative_lock_ai_hybrid ?? false;

  const AAS = getActiveScore(cff, "AAS", false);
  const CTF = getActiveScore(cff, "CTF", false);
  const RMD = getActiveScore(cff, "RMD", false);
  const RDX = getActiveScore(cff, "RDX", false);
  const EDS = getActiveScore(cff, "EDS", false);
  const IFD = getActiveScore(cff, "IFD", false);
  const KPF = getActiveScore(cff, "KPF-Sim", false);
  const TPS = getActiveScore(cff, "TPS-H", true);

  const Analyticity = avg(AAS, EDS);
  const Flow = avg(CTF, RMD);
  const MetacogRaw = avg(RDX, IFD);
  const Regulation = avg(RDX, IFD == null ? null : 1 - IFD);

  const Authenticity =
    KPF != null && TPS != null
      ? avg(1 - KPF, TPS)
      : KPF != null
        ? 1 - KPF
        : TPS != null
          ? TPS
          : null;

  const MachineScore =
    KPF != null && TPS != null
      ? avg(KPF, 1 - TPS)
      : KPF != null
        ? KPF
        : TPS != null
          ? 1 - TPS
          : null;

  const internalTrack: "Human" | "Hybrid" | "AI" =
    MachineScore == null
      ? conservativeLock
        ? "Human"
        : "Human"
      : conservativeLock
        ? "Human"
        : MachineScore >= 0.7
          ? "AI"
          : MachineScore >= 0.4
            ? "Hybrid"
            : "Human";

  function chooseHumanT(): { code: DetCode; conf: number } {
    const cand: Array<{ prio: number; code: DetCode; conf: number }> = [];

    if (Analyticity != null && Flow != null && MetacogRaw != null) {
      if (Analyticity >= 0.6 && Flow >= 0.6 && MetacogRaw >= 0.6) {
        const margin = Math.min(Analyticity - 0.6, Flow - 0.6, MetacogRaw - 0.6);
        cand.push({ prio: 4, code: "T4", conf: confFromMargin(margin) });
      }
    }

    const axis = t2Mode === "Regulation" ? Regulation : MetacogRaw;
    if (axis != null && axis >= 0.7) {
      const margin = axis - 0.7;
      cand.push({ prio: 3, code: "T2", conf: confFromMargin(margin) });
    }

    if (Analyticity != null && Flow != null) {
      if (Analyticity >= 0.7 && Flow < 0.55) {
        const margin = Math.min(Analyticity - 0.7, 0.55 - Flow);
        cand.push({ prio: 2, code: "T1", conf: confFromMargin(margin) });
      }
    }

    if (Flow != null && Analyticity != null) {
      if (Flow >= 0.7 && Analyticity < 0.55) {
        const margin = Math.min(Flow - 0.7, 0.55 - Analyticity);
        cand.push({ prio: 1, code: "T3", conf: confFromMargin(margin) });
      }
    }

    cand.sort((a, b) => b.prio - a.prio || b.conf - a.conf);
    if (cand.length === 0) return { code: "T2", conf: 0.6 };
    return { code: cand[0].code, conf: cand[0].conf };
  }

  function chooseAx(): { code: DetCode; conf: number } | null {
    if (AAS != null && RDX != null && RMD != null) {
      if (AAS >= 0.8 && RDX <= 0.4 && RMD <= 0.45) {
        const margin = Math.min(AAS - 0.8, 0.4 - RDX, 0.45 - RMD);
        return { code: "Ax-1", conf: confFromMargin(margin) };
      }
    }

    if (EDS != null && AAS != null && IFD != null) {
      if (EDS >= 0.8 && AAS >= 0.65 && IFD <= 0.4) {
        const margin = Math.min(EDS - 0.8, AAS - 0.65, 0.4 - IFD);
        return { code: "Ax-2", conf: confFromMargin(margin) };
      }
    }

    if (Flow != null && MachineScore != null) {
      if (Flow >= 0.65 && MachineScore >= 0.7) {
        const margin = Math.min(Flow - 0.65, MachineScore - 0.7);
        return { code: "Ax-3", conf: confFromMargin(margin) };
      }
    }

    if (AAS != null && RDX != null && IFD != null) {
      if (AAS >= 0.75 && RDX <= 0.45 && IFD <= 0.35) {
        const margin = Math.min(AAS - 0.75, 0.45 - RDX, 0.35 - IFD);
        return { code: "Ax-4", conf: confFromMargin(margin) };
      }
    }

    return null;
  }

  function chooseHx(): { code: DetCode; conf: number } | null {
    if (KPF == null) return null;

    if (RDX != null && RDX >= 0.6 && KPF >= 0.25 && KPF <= 0.55) {
      const margin = Math.min(RDX - 0.6, KPF - 0.25, 0.55 - KPF);
      return { code: "Hx-1", conf: confFromMargin(margin) };
    }

    if (AAS != null && CTF != null && AAS >= 0.6 && CTF >= 0.6 && KPF >= 0.25 && KPF <= 0.55) {
      const margin = Math.min(AAS - 0.6, CTF - 0.6, KPF - 0.25, 0.55 - KPF);
      return { code: "Hx-2", conf: confFromMargin(margin) };
    }

    if (EDS != null && EDS >= 0.75 && KPF >= 0.25 && KPF <= 0.55) {
      const margin = Math.min(EDS - 0.75, KPF - 0.25, 0.55 - KPF);
      return { code: "Hx-3", conf: confFromMargin(margin) };
    }

    if (AAS != null && RMD != null && AAS >= 0.7 && RMD <= 0.45 && KPF >= 0.45) {
      const margin = Math.min(AAS - 0.7, 0.45 - RMD, KPF - 0.45);
      return { code: "Hx-4", conf: confFromMargin(margin) };
    }

    return null;
  }

  function chooseT5T6(): { code: DetCode; conf: number } | null {
    if (Authenticity == null || MachineScore == null) return null;

    if (MachineScore >= 0.7 || Authenticity <= 0.4) {
      const margin = Math.max(MachineScore - 0.7, 0.4 - Authenticity);
      return { code: "T6", conf: confFromMargin(margin) };
    }

    if (Authenticity >= 0.75) {
      const margin = Authenticity - 0.75;
      return { code: "T5", conf: confFromMargin(margin) };
    }

    return null;
  }

  let finalCode: DetCode;
  let finalConf: number;

  if (internalTrack === "Human") {
    const t56 = chooseT5T6();
    if (t56) {
      finalCode = t56.code;
      finalConf = t56.conf;
    } else {
      const ht = chooseHumanT();
      finalCode = ht.code;
      finalConf = ht.conf;
    }
  } else if (internalTrack === "Hybrid") {
    const hx = chooseHx();
    if (hx) {
      finalCode = hx.code;
      finalConf = hx.conf;
    } else {
      const ht = chooseHumanT();
      finalCode = ht.code;
      finalConf = ht.conf;
    }
  } else {
    const ax = chooseAx();
    if (ax) {
      finalCode = ax.code;
      finalConf = ax.conf;
    } else {
      const ht = chooseHumanT();
      finalCode = ht.code;
      finalConf = ht.conf;
    }
  }

  const reg = TYPE_REGISTRY[finalCode];
  if (!reg) throw new Error("Unknown final_code for registry: " + finalCode);

  const label = finalCode + ". " + reg.type_name;
  const chipLabel = reg.type_name;

  const confidence = round2(clamp01(finalConf));

  const interpretation =
    INTERPRETATION_REGISTRY[finalCode] ??
    (reg.type_name + " reflects the dominant reasoning pattern inferred from the current indicator configuration.");

  return {
    cff: {
      final_type: {
        label,
        chip_label: chipLabel,
        confidence,
        interpretation,
      },
    },
  };
}

/*
======================================================
결과 json (예시)
======================================================

{
  "cff": {
    "final_type": {
      "label": "Ax-4. Reasoning Simulator",
      "chip_label": "Reasoning Simulator",
      "confidence": 0.81,
      "interpretation": "Ax-4. Reasoning Simulator reflects a reasoning structure that appears coherent and well-formed, while transitions and revisions are driven by simulated control patterns rather than direct intent formation."
    }
  }
}
*/


/* =====================
   deriveCff orchestrator
===================== */
export type DeriveCffInput = any;

export function deriveCff(input: DeriveCffInput): Record<string, any> {
  const ai = (input && typeof input === "object" && "analysis_input" in input)
    ? (input as any).analysis_input
    : input;

  const raw = ai?.raw_features ?? ai?.raw ?? ai?.rawFeatures ?? ai?.raw_features_v1 ?? ai?.raw_features_v2;

  const cff6 = raw ? computeCFF6_v1(raw as any) : { cff: { indicators: {} } };
  const patterns = raw ? computeObservedPatternsV2(raw as any) : { cff: { observed_patterns: [] } };

  const finalType = computeFinalDeterminationCff(
    { indicators: (cff6 as any)?.cff?.indicators ?? {} },
    {
      t2_mode: "Regulation",
      conservative_lock_ai_hybrid: true
    }
  );

  // merge
  return deepMergeAll(cff6, patterns, finalType);

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
