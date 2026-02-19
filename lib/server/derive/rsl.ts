
/* =====================
   SOURCE: Backend_1_RSL_Level.ts
   (verbatim from derive폴더.zip)
===================== */

export type RSLLevelCode = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

export interface RSLLevelMeta {
  level_short_name: string;
  level_full_name: string;
  level_description: string;
}

export interface RSLLevelInput {
  coherence_rubric_0to5: number;
  structure_rubric_0to5: number;
  evaluation_rubric_0to5: number;
  integration_rubric_0to5: number;
  evidence_count?: number;
  evidence_link_rate_0to1?: number;
  has_counterpoint?: boolean;
  has_refutation?: boolean;
}

export interface RSLLevelFlags {
  strict_mode: boolean;
  evidence_required_for_L4plus: boolean;
  allow_L6: boolean;
}

export interface RSLLevelPolicy {
  gate_L2_min: number; // usually 1
  gate_L3_min: number; // usually 2
  gate_L4_min: number; // usually 3
  gate_L5_min: number; // usually 4
  gate_L6_min: number; // usually 5
  min_evidence_count_for_L4plus: number;
  min_evidence_link_rate_for_L4plus: number;
  strict_gate_bonus: number; // added to each gate in strict mode
  l6_integration_min: number;
}

export interface RSLLevelResult {
  level: RSLLevelCode;
  meta: RSLLevelMeta;

  rubric_min: number;
  rubric_mean_0to5: number;
  evidence_ok: boolean;
  gates: {
    L2: boolean;
    L3: boolean;
    L4: boolean;
    L5: boolean;
    L6: boolean;
  };
}

const LEVEL_METADATA: Record<RSLLevelCode, RSLLevelMeta> = {
  L1: {
    level_short_name: "L1 Fragmented",
    level_full_name: "L1 Fragmented Reasoning",
    level_description:
      "Unstable reasoning with weak structure and low coherence across claims."
  },
  L2: {
    level_short_name: "L2 Linear",
    level_full_name: "Linear Reasoning",
    level_description:
      "Basic sequential reasoning with limited structural branching or evaluation."
  },
  L3: {
    level_short_name: "L3 Structured",
    level_full_name: "L3 Structured Reasoning",
    level_description:
      "Organized reasoning components with partial coordination across dimensions."
  },
  L4: {
    level_short_name: "L4 Coordinated",
    level_full_name: "L4 Coordinated Reasoning",
    level_description:
      "Multiple reasoning dimensions are coordinated with evidence support and evaluation."
  },
  L5: {
    level_short_name: "L5 Integrated",
    level_full_name: "L5 Integrated Reasoning",
    level_description:
      "Reasoning dimensions integrate into a stable, non-dominant structure with balanced evaluation."
  },
  L6: {
    level_short_name: "L6 Expert",
    level_full_name: "L6 Expert Reasoning",
    level_description:
      "Consistently expert-level reasoning with high integration, evaluation depth, and structural control."
  }
};

function clampInt0to5(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const r = Math.round(x);
  if (r < 0) return 0;
  if (r > 5) return 5;
  return r;
}

function clamp01(x: number | undefined): number {
  const v = typeof x === "number" && Number.isFinite(x) ? x : 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function bool(x: boolean | undefined): boolean {
  return x === true;
}

function evidenceOK(
  inp: RSLLevelInput,
  policy: RSLLevelPolicy,
  flags: RSLLevelFlags
): boolean {
  if (!flags.evidence_required_for_L4plus) return true;
  const evCount = typeof inp.evidence_count === "number" ? inp.evidence_count : 0;
  const evLink = clamp01(inp.evidence_link_rate_0to1);
  if (evCount < policy.min_evidence_count_for_L4plus) return false;
  if (evLink < policy.min_evidence_link_rate_for_L4plus) return false;
  return true;
}

function adjustedGate(base: number, flags: RSLLevelFlags, policy: RSLLevelPolicy): number {
  const b = clampInt0to5(base);
  const add = flags.strict_mode ? policy.strict_gate_bonus : 0;
  const out = b + add;
  if (out < 0) return 0;
  if (out > 5) return 5;
  return out;
}

export function computeRSLLevel(
  inp: RSLLevelInput,
  flags: RSLLevelFlags,
  policy: RSLLevelPolicy
): RSLLevelResult {
  const coherence = clampInt0to5(inp.coherence_rubric_0to5);
  const structure = clampInt0to5(inp.structure_rubric_0to5);
  const evaluation = clampInt0to5(inp.evaluation_rubric_0to5);
  const integration = clampInt0to5(inp.integration_rubric_0to5);

  const rubricMin = Math.min(coherence, structure, evaluation, integration);
  const rubricMean = (coherence + structure + evaluation + integration) / 4;

  const g2 = adjustedGate(policy.gate_L2_min, flags, policy);
  const g3 = adjustedGate(policy.gate_L3_min, flags, policy);
  const g4 = adjustedGate(policy.gate_L4_min, flags, policy);
  const g5 = adjustedGate(policy.gate_L5_min, flags, policy);
  const g6 = adjustedGate(policy.gate_L6_min, flags, policy);

  const evOK = evidenceOK(inp, policy, flags);

  const hasCounter = bool(inp.has_counterpoint);
  const hasRefute = bool(inp.has_refutation);

  const passL2 = rubricMin >= g2;
  const passL3 = rubricMin >= g3;
  const passL4 = rubricMin >= g4 && evOK;
  const passL5Base = rubricMin >= g5 && evOK;
  const passL5 = flags.strict_mode ? passL5Base && (hasCounter || hasRefute) : passL5Base;
  const passL6 =
    flags.allow_L6 &&
    passL5 &&
    rubricMin >= g6 &&
    integration >= policy.l6_integration_min;

  let level: RSLLevelCode = "L1";
  if (passL2) level = "L2";
  if (passL3) level = "L3";
  if (passL4) level = "L4";
  if (passL5) level = "L5";
  if (passL6) level = "L6";

  return {
    level,
    meta: LEVEL_METADATA[level],
    rubric_min: rubricMin,
    rubric_mean_0to5: rubricMean,
    evidence_ok: evOK,
    gates: {
      L2: passL2,
      L3: passL3,
      L4: passL4,
      L5: passL5,
      L6: passL6
    }
  };
}

export function computeRSLLevelMetaOnly(
  inp: RSLLevelInput,
  flags: RSLLevelFlags,
  policy: RSLLevelPolicy
): RSLLevelMeta {
  const res = computeRSLLevel(inp, flags, policy);
  return res.meta;
}

/**
 * 원하는 최종 API 응답 스키마:
 * {
 *   "rsl": {
 *     "level": {
 *       "short_name": "...",
 *       "full_name": "...",
 *       "definition": "..."
 *     }
 *   }
 * }
 */
export interface RSLApiResponse {
  rsl: {
    level: {
      short_name: string;
      full_name: string;
      definition: string;
    };
  };
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json();

  const rslMeta = computeRSLLevelMetaOnly(
    body.input,
    body.flags,
    body.policy
  );

  const response: RSLApiResponse = {
    rsl: {
      level: {
        short_name: rslMeta.level_short_name,
        full_name: rslMeta.level_full_name,
        definition: rslMeta.level_description
      }
    }
  };

  return Response.json(response);
}

/*
======================================================
결과 json (예시)
======================================================

{
  "rsl": {
    "level": {
      "short_name": "L3 Structured",
      "full_name": "L3 Structured Reasoning",
      "definition": "Organized reasoning components with partial coordination across dimensions."
    }
  }
}
*/


/* =====================
   SOURCE: Backend_2_FRI.ts
   (verbatim from derive폴더.zip)
===================== */

/* fri.ts
   - Backend_2_FRI.py -> TypeScript
   - Rubric inputs are 0..5, output 0..5
*/

export type FRIResult = {
  rsl: {
    fri: {
      score: number;
      interpretation: string;
    };
  };
};

function clamp0to5(x: number): number {
  const v = Number.isFinite(x) ? x : 0;
  return Math.max(0, Math.min(5, v));
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export function computeFRI(
  R3: number,
  R4: number,
  R5: number,
  R6: number
): FRIResult {

  const CRS =
    0.3 * clamp0to5(R3) +
    0.4 * clamp0to5(R4) +
    0.3 * clamp0to5(R5);

  const RM =
    0.85 + (clamp0to5(R6) / 5) * 0.3;

  const FRI = clamp0to5(CRS * RM);
  const friRounded = round2(FRI);

  return {
    rsl: {
      fri: {
        score: friRounded,
        interpretation: friNote(friRounded)
      }
    }
  };
}

export function friNote(fri: number): string {
  const x = Number.isFinite(fri) ? fri : 0;

  if (x <= 0.79) {
    return "Your reasoning structure is still taking shape. Ideas often appear separately, making connections harder to follow.";
  }
  if (x <= 1.59) {
    return "Early signs of structure are beginning to appear. Some steps are present, but connections and checks are not yet consistent.";
  }
  if (x <= 2.39) {
    return "A basic reasoning structure is forming. Key steps align, though stability can drop as complexity increases.";
  }
  if (x <= 3.19) {
    return "Your reasoning structure works well overall. Most ideas connect, with occasional gaps in validation or monitoring.";
  }
  if (x <= 3.99) {
    return "Your reasoning structure is stable in most situations. Connections and evaluations usually remain consistent.";
  }
  return "You can reason structurally even in complex situations. Your thinking stays stable and self-regulated as ideas scale.";
}

/*
======================================================
결과 json (예시)
======================================================
{
  "rsl": {
    "fri": {
      "score": 3.72,
      "interpretation": "Your reasoning structure is stable in most situations. Connections and evaluations usually remain consistent."
    }
  }
}
*/


/* =====================
   SOURCE: Backend_3_Cohort.ts
   (verbatim from derive폴더.zip)
===================== */

function round4(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export function percentile0to1(
  friValue: number,
  cohortFriList: number[]
): number {
  if (!Array.isArray(cohortFriList) || cohortFriList.length === 0) return 0.5;

  const v = Number.isFinite(friValue) ? friValue : 0;
  let lower = 0;

  for (const x of cohortFriList) {
    const xx = Number.isFinite(x) ? x : 0;
    if (xx < v) lower += 1;
  }

  return round4(lower / cohortFriList.length);
}

export function topPercentLabel(percentile: number): string {
  const p = Number.isFinite(percentile) ? percentile : 0.5;
  const topPercent = Math.round((1 - p) * 100);

  if (topPercent <= 1) return "Top 1%";
  return `Top ${topPercent}%`;
}

export function cohortInterpretationFromTopPercent(topPercentValue: number): string {
  const t = Number.isFinite(topPercentValue) ? topPercentValue : 50;

  if (t >= 50) {
    return "Core reasoning steps are emerging, with structure still developing compared to most peers.";
  }
  if (t >= 30) {
    return "Developing structure, with several reasoning patterns beginning to align relative to comparable peers.";
  }
  if (t >= 20) {
    return "Generally well-structured reasoning compared to most peers, with room for further stabilization.";
  }
  if (t >= 10) {
    return "Consistently structured reasoning relative to comparable peers.";
  }
  if (t >= 5) {
    return "Highly consistent reasoning structure compared to most peers, even as complexity increases.";
  }
  return "Exceptionally stable reasoning structure within the current comparison group.";
}

/* ============================
   최종 API 반환 타입 (UPDATED)
============================ */

export interface RslCohortApiResponse {
  rsl: {
    cohort: {
      percentile_0to1: number;
      top_percent_label: string;
      interpretation: string;
    };
  };
}

/* ============================
   API용 계산 래퍼 (UPDATED)
============================ */

export function computeRslCohortResponse(
  friValue: number,
  cohortFriList: number[]
): RslCohortApiResponse {
  const percentile = percentile0to1(friValue, cohortFriList);
  const label = topPercentLabel(percentile);

  const topPercentValue = Math.round((1 - percentile) * 100);
  const interpretation = cohortInterpretationFromTopPercent(topPercentValue);

  return {
    rsl: {
      cohort: {
        percentile_0to1: percentile,
        top_percent_label: label,
        interpretation
      }
    }
  };
}

/*
======================================================
결과 json (예시)
======================================================

{
  "rsl": {
    "cohort": {
      "percentile_0to1": 0.62,
      "top_percent_label": "Top 38%",
      "interpretation": "Developing structure, with several reasoning patterns beginning to align relative to comparable peers."
    }
  }
}
*/


/* =====================
   SOURCE: Backend_4_SRI.ts
   (verbatim from derive폴더.zip)
===================== */

/* ======================================================
   RSL Rubric(4) + rslVector(4) + transition/meta scores
   Raw Features 기반, MVP 고정 수식 (결정적, 0..1/0..5)
   ====================================================== */

export type SRIBand = "HIGH" | "MODERATE" | "LOW";

export type SRIInputs = {
  rslVector: number[]; // required, length >= 2 (we use length=4)
  transitionJumpScore?: number | null; // 0..1 higher is worse
  metaImbalanceScore?: number | null;  // 0..1 higher is worse
  extra?: Record<string, number | null | undefined>;
};

export type SRIOutput = {
  sri: number; // 0..1
  band: SRIBand;
  notes: string;
  diagnostics: {
    varianceScore: number;   // 0..1 (higher is worse)
    transitionScore: number; // 0..1 (higher is worse)
    metaScore: number;       // 0..1 (higher is worse)
    instability: number;     // 0..1
    weights: { wVar: number; wTrans: number; wMeta: number };
  };
};

export type SRIRslPublicOutput = {
  rsl: {
    sri: {
      score: number;
      interpretation: string;
    };
  };
};

/* ======================
   Raw Features 타입
   (canonical json 구조에 맞춘 최소 타입)
   ====================== */

export type RawFeatures = {
  layer_0?: {
    units?: number;
    unit_lengths?: number[];
    per_unit?: {
      transitions?: number[];
      revisions?: number[];
    };
    claims?: number;
    reasons?: number;
    evidence?: number;
  };
  layer_1?: {
    warrants?: number;
    counterpoints?: number;
    refutations?: number;
  };
  layer_2?: {
    transitions?: number;
    transition_ok?: number;
    revisions?: number;
    revision_depth_sum?: number;
    belief_change?: boolean;
  };
  layer_3?: {
    intent_markers?: number;
    drift_segments?: number;
    hedges?: number;
    loops?: number;
    self_regulation_signals?: number;
  };
  adjacency_links?: number;
};

export type RslRubric4 = {
  coherence: number;   // 0..5
  structure: number;   // 0..5
  evaluation: number;  // 0..5
  integration: number; // 0..5
};

/* ======================
   Basic helpers
   ====================== */

function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function clamp(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x)) return lo;
  return x < lo ? lo : x > hi ? hi : x;
}


function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[]): number {
  if (!xs.length) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

function safeInt(x: unknown, fallback = 0): number {
  return isFiniteNumber(x) ? Math.max(0, Math.floor(x)) : fallback;
}

function safeNum(x: unknown, fallback = 0): number {
  return isFiniteNumber(x) ? x : fallback;
}

function safeArray(x: unknown): number[] {
  return Array.isArray(x) ? x.filter((v) => isFiniteNumber(v)).map((v) => Number(v)) : [];
}

/**
 * 0..1로 정규화된 엔트로피(균형 지표)
 * - 입력은 양수 카운트 벡터
 * - 1에 가까울수록 균형적, 0에 가까울수록 한쪽 쏠림
 */
function entropy01(counts: number[]): number {
  const xs = counts.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const s = xs.reduce((a, b) => a + b, 0);
  if (s <= 0) return 0;
  const ps = xs.map((v) => v / s).filter((p) => p > 0);
  const h = -ps.reduce((acc, p) => acc + p * Math.log(p), 0);
  const hMax = Math.log(ps.length || 1);
  if (hMax <= 0) return 0;
  return clamp01(h / hMax);
}

/**
 * bell curve like score around a target
 * - returns 1 at target
 * - decreases linearly to 0 at target +/- width
 */
function peak01(x: number, target: number, width: number): number {
  if (!Number.isFinite(x) || width <= 0) return 0;
  const d = Math.abs(x - target);
  return clamp01(1 - d / width);
}

/* ======================
   1) Raw -> rubric(0..5)
   ====================== */

export function computeRslRubric4FromRaw(raw: RawFeatures): RslRubric4 {
  // core counts
  const units = Math.max(1, safeInt(raw.layer_0?.units, 1));
  const claims = safeInt(raw.layer_0?.claims, 0);
  const reasons = safeInt(raw.layer_0?.reasons, 0);
  const evidence = safeInt(raw.layer_0?.evidence, 0);

  const warrants = safeInt(raw.layer_1?.warrants, 0);
  const counterpoints = safeInt(raw.layer_1?.counterpoints, 0);
  const refutations = safeInt(raw.layer_1?.refutations, 0);

  const transitions = safeInt(raw.layer_2?.transitions, 0);
  const transitionOk = safeInt(raw.layer_2?.transition_ok, 0);
  const revisions = safeInt(raw.layer_2?.revisions, 0);
  const revisionDepthSum = safeNum(raw.layer_2?.revision_depth_sum, 0);

  const intentMarkers = safeInt(raw.layer_3?.intent_markers, 0);
  const driftSegments = safeInt(raw.layer_3?.drift_segments, 0);
  const hedges = safeInt(raw.layer_3?.hedges, 0);
  const loops = safeInt(raw.layer_3?.loops, 0);
  const selfReg = safeInt(raw.layer_3?.self_regulation_signals, 0);

  const adjacencyLinks = safeInt(raw.adjacency_links, 0);

  // derived ratios (0..1)
  const denomTrans = Math.max(1, units - 1);
  const transRate = clamp01(transitions / denomTrans); // "구조 전환 빈도"
  const transQuality = clamp01(transitionOk / Math.max(1, transitions)); // "전환 품질"

  const revRate = clamp01(revisions / Math.max(1, units));
  // revision depth average, normalize by 1.5 (MVP calibration constant)
  const revDepthAvg = revisionDepthSum / Math.max(1, revisions);
  const revDepth01 = clamp01(revDepthAvg / 1.5);

  const driftRate = clamp01((driftSegments + loops) / Math.max(1, units));
  const driftPenalty = driftRate; // higher worse

  // adjacency density: links relative to reasoning atoms
  const atoms = Math.max(1, claims + reasons + warrants + evidence);
  const adjacency01 = clamp01(adjacencyLinks / atoms);

  // evidence support for evaluation
  const evidencePerClaim = evidence / Math.max(1, claims);
  const warrantsPerClaim = warrants / Math.max(1, claims);
  const counterRefPerClaim = (counterpoints + refutations) / Math.max(1, claims);

  const evidence01 = clamp01(evidencePerClaim / 1.0); // 1 evidence per claim -> 1
  const warrant01 = clamp01(warrantsPerClaim / 1.0);  // 1 warrant per claim -> 1
  const counterRef01 = clamp01(counterRefPerClaim / 0.6); // 0.6 per claim -> 1

  const hedgeRate = hedges / Math.max(1, claims);
  const hedgePenalty = clamp01(hedgeRate / 0.7); // too many hedges -> worse

  // balance among claim/reason/warrant/evidence (integration)
  const balance01 = entropy01([claims, reasons, warrants, evidence]);

  /* --------------------------------------------
     Rubric scores (0..5), deterministic weights
     -------------------------------------------- */

  // coherence: transition quality + adjacency + low drift
  const coherence01 = clamp01(
    0.45 * transQuality +
    0.25 * adjacency01 +
    0.30 * (1 - driftPenalty)
  );

  // structure: enough transitions + intent markers + "moderate" revision rate
  // revision rate is best around 0.15 per unit (MVP target)
  const revModeration01 = peak01(revRate, 0.15, 0.15); // 0.0 or 0.30 -> 0, 0.15 -> 1
  const intent01 = clamp01(intentMarkers / 2); // 0..2+ -> 0..1
  const structure01 = clamp01(
    0.40 * transRate +
    0.30 * intent01 +
    0.30 * revModeration01
  );

  // evaluation: evidence + warrants + counter/refutation, penalize excessive hedging
  const evaluation01 = clamp01(
    0.35 * evidence01 +
    0.25 * warrant01 +
    0.25 * counterRef01 +
    0.15 * (1 - hedgePenalty)
  );

  // integration: balance + self regulation + transition quality + depth
  const selfReg01 = clamp01(selfReg / 2); // 0..2+ -> 0..1
  const integration01 = clamp01(
    0.50 * balance01 +
    0.20 * selfReg01 +
    0.20 * transQuality +
    0.10 * revDepth01
  );

  // convert to 0..5 (rounding strategy: keep 2 decimals, not int)
  const coherence = round2(5 * coherence01);
  const structure = round2(5 * structure01);
  const evaluationScore = round2(5 * evaluation01);
  const integration = round2(5 * integration01);

  return {
    coherence,
    structure,
    evaluation: evaluationScore,
    integration
  };
}

/* ======================
   2) rubric -> rslVector
   ====================== */

export function computeRslVectorFromRubric4(r: RslRubric4): number[] {
  // rslVector is 0..1, fixed length 4
  const c = clamp01(safeNum(r.coherence, 0) / 5);
  const s = clamp01(safeNum(r.structure, 0) / 5);
  const e = clamp01(safeNum(r.evaluation, 0) / 5);
  const i = clamp01(safeNum(r.integration, 0) / 5);
  return [c, s, e, i];
}

/* ==========================================
   3) Raw -> transitionJumpScore/metaImbalance
   ========================================== */

/**
 * transitionJumpScore: 0..1 (higher is worse)
 * - "전환 품질 부족" + "전환의 단위별 변동성" + "문단 길이 변동(점프 근사)"
 */
export function computeTransitionJumpScoreFromRaw(raw: RawFeatures): number {
  const units = Math.max(1, safeInt(raw.layer_0?.units, 1));

  const transitions = safeInt(raw.layer_2?.transitions, 0);
  const transitionOk = safeInt(raw.layer_2?.transition_ok, 0);

  const transQuality = clamp01(transitionOk / Math.max(1, transitions));
  const badRate = clamp01(1 - transQuality);

  const perUnitTrans = safeArray(raw.layer_0?.per_unit?.transitions);
  const vol =
    perUnitTrans.length > 1
      ? clamp01(std(perUnitTrans) / Math.max(1, mean(perUnitTrans) + 1))
      : 0.5;

  const unitLengths = safeArray(raw.layer_0?.unit_lengths);
  const lenVar =
    unitLengths.length > 1
      ? clamp01(std(unitLengths) / Math.max(1, mean(unitLengths)))
      : 0.5;

  // If very few units, reduce sensitivity
  const smallUnitsPenalty = units < 3 ? 0.15 : 0;

  const score = clamp01(0.50 * badRate + 0.25 * vol + 0.25 * lenVar + smallUnitsPenalty);
  return score;
}

/**
 * metaImbalanceScore: 0..1 (higher is worse)
 * - claim/reason/warrant/evidence 균형 부족(엔트로피 기반) + drift/loop + hedge 과다
 */
export function computeMetaImbalanceScoreFromRaw(raw: RawFeatures): number {
  const units = Math.max(1, safeInt(raw.layer_0?.units, 1));

  const claims = safeInt(raw.layer_0?.claims, 0);
  const reasons = safeInt(raw.layer_0?.reasons, 0);
  const evidence = safeInt(raw.layer_0?.evidence, 0);
  const warrants = safeInt(raw.layer_1?.warrants, 0);

  const driftSegments = safeInt(raw.layer_3?.drift_segments, 0);
  const loops = safeInt(raw.layer_3?.loops, 0);
  const hedges = safeInt(raw.layer_3?.hedges, 0);

  const bal = entropy01([claims, reasons, warrants, evidence]); // 0..1 (higher is better)
  const imbalanceCore = clamp01(1 - bal); // higher is worse

  const driftRate = clamp01((driftSegments + loops) / Math.max(1, units));
  const driftPenalty = clamp01(driftRate / 0.25); // 0.25 per unit -> 1

  const hedgeRate = hedges / Math.max(1, claims);
  const hedgePenalty = clamp01(hedgeRate / 0.7);

  const score = clamp01(0.60 * imbalanceCore + 0.20 * driftPenalty + 0.20 * hedgePenalty);
  return score;
}

/* ======================
   4) SRI core (from Backend_4_SRI)
   유지하되, rslVector가 항상 들어오도록 상위에서 보장
   ====================== */

function computeVarianceScore(rslVector01: number[]): number {
  const s = std(rslVector01);
  return clamp01(s / 0.5);
}

export function computeSRI(inputs: SRIInputs): SRIOutput {
  const { rslVector } = inputs;

  if (!Array.isArray(rslVector) || rslVector.length < 2) {
    const sri = 0.5;
    return {
      sri,
      band: "MODERATE",
      notes:
        "Structural reliability is not fully available due to insufficient structural data. Results are shown with coaching emphasis.",
      diagnostics: {
        varianceScore: 0.5,
        transitionScore: 0.5,
        metaScore: 0.5,
        instability: 0.5,
        weights: { wVar: 0.4, wTrans: 0.3, wMeta: 0.3 },
      },
    };
  }

  const v01 = rslVector.map((x) => clamp01(isFiniteNumber(x) ? x : 0));

  const varianceScore = computeVarianceScore(v01);
  const transitionScore = clamp01(
    isFiniteNumber(inputs.transitionJumpScore) ? inputs.transitionJumpScore : 0.5,
  );
  const metaScore = clamp01(
    isFiniteNumber(inputs.metaImbalanceScore) ? inputs.metaImbalanceScore : 0.5,
  );

  const wVar = 0.4;
  const wTrans = 0.3;
  const wMeta = 0.3;

  const instability = clamp01(wVar * varianceScore + wTrans * transitionScore + wMeta * metaScore);
  const sri = clamp01(1 - instability);

  let band: SRIBand;
  let notes: string;

  if (sri >= 0.8) {
    band = "HIGH";
    notes =
      "Structural coherence is consistently maintained across reasoning segments. The structural reference is considered stable.";
  } else if (sri >= 0.65) {
    band = "MODERATE";
    notes = "Structural coherence is generally maintained, with localized variability across segments. Stability is acceptable with moderate fluctuation.";
  } else {
    band = "LOW";
    notes =
      "Structural variability is evident across reasoning segments. Stability is limited and interpretive caution is advised.";
  }

  return {
    sri,
    band,
    notes,
    diagnostics: {
      varianceScore,
      transitionScore,
      metaScore,
      instability,
      weights: { wVar, wTrans, wMeta },
    },
  };
}

export function computeSRIRslPublic(inputs: SRIInputs): SRIRslPublicOutput {
  const res = computeSRI(inputs);
  return {
    rsl: {
      sri: {
        score: round2(res.sri),
        interpretation: res.notes
      }
    }
  };
}

/**
 * PUBLIC ONE-SHOT (MVP SSOT)
 * Raw Features만 주면, 아래 형식으로만 반환합니다:
 *
 * {
 *   "rsl": {
 *     "sri": {
 *       "score": 0.92,
 *       "interpretation": "..."
 *     }
 *   }
 * }
 *
 * - rslVector는 rubric4(0..5)를 0..1로 정규화한 [coherence, structure, evaluation, integration] (길이 4) 입니다.
 * - transitionJumpScore/metaImbalanceScore도 raw에서 계산됩니다.
 * - 출력은 SSOT로 이 구조만 반환합니다.
 */
export function computeSRIRslPublicFromRaw(raw: RawFeatures): SRIRslPublicOutput {
  const rubric = computeRslRubric4FromRaw(raw);
  const rslVector = computeRslVectorFromRubric4(rubric);
  const transitionJumpScore = computeTransitionJumpScoreFromRaw(raw);
  const metaImbalanceScore = computeMetaImbalanceScoreFromRaw(raw);

  return computeSRIRslPublic({
    rslVector,
    transitionJumpScore,
    metaImbalanceScore,
  });
}


/* ==========================================
   5) One-shot: raw_features만 주면 SRI까지 완성
   ========================================== */

export type RslSriDerived = {
  rsl_rubric: RslRubric4;
  rslVector: number[]; // length 4, 0..1
  transitionJumpScore: number; // 0..1 (higher worse)
  metaImbalanceScore: number;  // 0..1 (higher worse)
  sri: SRIOutput;
};

export function deriveRslSriFromRaw(raw: RawFeatures): RslSriDerived {
  const rubric = computeRslRubric4FromRaw(raw);
  const rslVector = computeRslVectorFromRubric4(rubric);

  const transitionJumpScore = computeTransitionJumpScoreFromRaw(raw);
  const metaImbalanceScore = computeMetaImbalanceScoreFromRaw(raw);

  const sri = computeSRI({
    rslVector,
    transitionJumpScore,
    metaImbalanceScore
  });

  return {
    rsl_rubric: rubric,
    rslVector,
    transitionJumpScore,
    metaImbalanceScore,
    sri
  };
}


/* =====================
   deriveRsl orchestrator
   - Accepts either { analysis_input: {...} } or direct {...}
   - Returns partial report JSON under keys used by UI (rsl.*)
===================== */

export type DeriveRslInput = any;

export function deriveRsl(input: DeriveRslInput): Record<string, any> {
  const ai = (input && typeof input === "object" && "analysis_input" in input)
    ? (input as any).analysis_input
    : input;

  const raw = ai?.raw_features ?? ai?.raw ?? ai?.rawFeatures ?? ai?.raw_features_v1 ?? ai?.raw_features_v2;
  const rubric = ai?.rsl_rubric ?? ai?.rubric ?? ai?.rslRubric;

  // RSL Level (rubric-driven)
  const coherence = Number(rubric?.coherence ?? rubric?.coherence_rubric_0to5 ?? 0);
  const structure = Number(rubric?.structure ?? rubric?.structure_rubric_0to5 ?? 0);
  const evaluation = Number(rubric?.evaluation ?? rubric?.evaluation_rubric_0to5 ?? 0);
  const integration = Number(rubric?.integration ?? rubric?.integration_rubric_0to5 ?? 0);

  const evidenceCount = Number(raw?.layer_0?.evidence ?? raw?.layer_0?.evidence_count ?? 0);
  const hasCounterpoint = Boolean(raw?.layer_1?.counterpoints ?? raw?.layer_1?.has_counterpoint);
  const hasRefutation = Boolean(raw?.layer_1?.refutations ?? raw?.layer_1?.has_refutation);

  const levelFlags: RSLLevelFlags = {
    strict_mode: false,
    evidence_required_for_L4plus: true,
    allow_L6: true
  };

  const levelPolicy: RSLLevelPolicy = {
    gate_L2_min: 1,
    gate_L3_min: 2,
    gate_L4_min: 3,
    gate_L5_min: 4,
    gate_L6_min: 5,
    min_evidence_count_for_L4plus: 2,
    min_evidence_link_rate_for_L4plus: 0.3,
    strict_gate_bonus: 0,
    l6_integration_min: 5
  };

  const levelRes = computeRSLLevel(
    {
      coherence_rubric_0to5: coherence,
      structure_rubric_0to5: structure,
      evaluation_rubric_0to5: evaluation,
      integration_rubric_0to5: integration,
      evidence_count: evidenceCount,
      evidence_link_rate_0to1: undefined,
      has_counterpoint: hasCounterpoint,
      has_refutation: hasRefutation
    },
    levelFlags,
    levelPolicy
  );

  // FRI (rubric-driven: R3..R6 correspond to rubric dimensions)
  const friRes = computeFRI(coherence, structure, evaluation, integration);

  // Cohort positioning (optional cohort list from input)
  const cohortList: number[] = Array.isArray(ai?.cohort_fri_list) ? ai.cohort_fri_list : [];
  const friScore = friRes?.rsl?.fri?.score ?? 0;
  const pct = percentile0to1(friScore, cohortList);
  const topLabel = topPercentLabel(pct);
  const topValue = Number(topLabel.replace(/[^0-9]/g, "")) || Math.round((1 - pct) * 100);

  const cohort = {
    rsl: {
      charts: {
        cohort_positioning: {
          current: { x: pct, y: friScore },
          percentile_0to1: pct,
          top_percent_label: topLabel,
          interpretation: cohortInterpretationFromTopPercent(topValue)
        }
      }
    }
  };

  // SRI (raw-driven)
  const rubric4 = raw ? computeRslRubric4FromRaw(raw as any) : null;

  // computeSRI expects SRIInputs (vector + scores). We derive minimal inputs from rubric4 if available.
  let sriOut: SRIRslPublicOutput | null = null;
  try {
    if (rubric4 && (rubric4 as any)?.rslVector) {
      const rslVector = (rubric4 as any).rslVector as number[];
      const transitionJumpScore = (rubric4 as any).transitionJumpScore ?? null;
      const metaImbalanceScore = (rubric4 as any).metaImbalanceScore ?? null;
      const s = computeSRI({ rslVector, transitionJumpScore, metaImbalanceScore });
      sriOut = {
        rsl: {
          sri: {
            score: s.sri,
            interpretation: s.notes
          }
        }
      };
    }
  } catch {
    sriOut = null;
  }

  // Base rsl object merge
  const out: any = {
    rsl: {
      level: levelRes.level,
      level_meta: levelRes.meta,
      rubric: {
        coherence,
        structure,
        evaluation,
        integration
      }
    }
  };

  // merge in nested rsl outputs from components
  Object.assign(out, friRes);
  if (cohort) out.rsl = deepMerge(out.rsl, cohort.rsl);
  if (rubric4 && (rubric4 as any).rsl?.rubric4) out.rsl = deepMerge(out.rsl, (rubric4 as any).rsl);
  if (sriOut) out.rsl = deepMerge(out.rsl, sriOut.rsl);

  return out;

  function deepMerge(a: any, b: any): any {
    if (!a || typeof a !== "object") return b;
    if (!b || typeof b !== "object") return a;
    const out = Array.isArray(a) ? [...a] : { ...a };
    for (const k of Object.keys(b)) {
      const av = (out as any)[k];
      const bv = (b as any)[k];
      if (av && typeof av === "object" && bv && typeof bv === "object" && !Array.isArray(av) && !Array.isArray(bv)) {
        (out as any)[k] = deepMerge(av, bv);
      } else {
        (out as any)[k] = bv;
      }
    }
    return out;
  }
}
