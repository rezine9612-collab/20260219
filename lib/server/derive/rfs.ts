
/* =====================
   SOURCE: Backend_12_Cognitive Style Summary.ts
   (verbatim from derive폴더.zip)
===================== */

/* =========================================================
   Cognitive Role Fit (compact) v1.2 (BACKEND ONLY)
   - Deterministic, no external model calls
   - Output JSON shape matches UI contract:

   {
     "rfs": {
       "primary_pattern": "...",
       "representative_phrase": "..."
     }
   }

   IMPORTANT:
   - This file MUST NOT generate narrative/interpretation text.
   - Any interpretation layer must live elsewhere to avoid duplication.
   - Keeps the same 9-type thresholding (0.67 / 0.45).
   - Simplifies scoring weights to reduce code and avoid overfitting.
   - All inputs are treated as 0..1 normalized values.
   ========================================================= */

export type StyleInputs = {
  aas: number;
  ctf: number;
  rmd: number;
  rdx: number;
  eds: number;
  ifd: number;

  // If you do not have these yet, pass 0 and the classifier still works.
  rsl_control: number;
  rsl_validation: number;
  rsl_hypothesis: number;
  rsl_expansion: number;
};

export type StyleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type RfsJson = {
  rfs: {
    primary_pattern: string;
    representative_phrase: string;
  };
};

function clamp01(x: number): number {
  if (!(typeof x === "number" && isFinite(x))) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function safe01(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return clamp01(typeof n === "number" && isFinite(n) ? n : 0);
}

/* ----------------------------
   9-type mapping (minimal)
----------------------------- */

const DEFAULT_PRIMARY_PATTERN: Record<StyleId, string> = {
  1: "Reflective Explorer",
  2: "Reflective Explorer",
  3: "Analytical Reasoner",
  4: "Intuitive Explorer",
  5: "Reflective Explorer",
  6: "Procedural Thinker",
  7: "Creative Explorer",
  8: "Associative Thinker",
  9: "Linear Responder",
};

const PHRASE_MAP: Record<StyleId, string> = {
  1: "structured and exploratory",
  2: "structured but exploratory",
  3: "highly structured and deliberate",
  4: "exploratory with emerging structure",
  5: "balanced and adaptive",
  6: "moderately structured and steady",
  7: "highly exploratory and fluid",
  8: "loosely structured with exploration",
  9: "unstructured and linear",
};

/* ----------------------------
   Compact score functions
   - fewer terms, fewer helpers
----------------------------- */

export function computeStructureScore(m: StyleInputs): number {
  // Structure focuses on explicit organization and clarity.
  // Keep it simple: core structure signals and a small penalty for instability.
  const s =
    0.40 * safe01(m.rdx) +
    0.30 * safe01(m.aas) +
    0.20 * safe01(m.eds) +
    0.10 * (1 - safe01(m.ifd));
  return clamp01(s);
}

export function computeExplorationScore(m: StyleInputs): number {
  // Exploration focuses on branching, hypothesis movement, and discovery intent.
  // Use CFF exploration signals plus a light RSL proxy if available.
  const e =
    0.45 * safe01(m.ctf) +
    0.25 * safe01(m.rmd) +
    0.20 * safe01(m.rsl_hypothesis) +
    0.10 * safe01(m.rsl_expansion);
  return clamp01(e);
}

/**
 * 9-type classifier (unchanged thresholds):
 * HIGH >= 0.67
 * MEDIUM >= 0.45
 */
export function classifyStyleId(structure: number, exploration: number): StyleId {
  const S = clamp01(structure);
  const E = clamp01(exploration);

  if (S >= 0.67 && E >= 0.67) return 1;
  if (S >= 0.67 && E >= 0.45) return 2;
  if (S >= 0.67 && E < 0.45) return 3;

  if (S >= 0.45 && E >= 0.67) return 4;
  if (S >= 0.45 && E >= 0.45) return 5;
  if (S >= 0.45 && E < 0.45) return 6;

  if (S < 0.45 && E >= 0.67) return 7;
  if (S < 0.45 && E >= 0.45) return 8;

  return 9;
}

/* ----------------------------
   Public API: rfs output (no interpretation)
----------------------------- */

export function computeRfs9Type(inputs: StyleInputs): RfsJson {
  const structure = computeStructureScore(inputs);
  const exploration = computeExplorationScore(inputs);

  const styleId = classifyStyleId(structure, exploration);

  return {
    rfs: {
      primary_pattern: DEFAULT_PRIMARY_PATTERN[styleId],
      representative_phrase: PHRASE_MAP[styleId],
    },
  };
}

/* ----------------------------
   Optional adapter: payload -> inputs
   - Keep it tiny, do not compute heavy proxies here.
   - If you already compute rsl_* elsewhere, pass them through.
----------------------------- */

export type CognitiveRoleFitPayload = {
  cff: {
    aas: number;
    ctf: number;
    rmd: number;
    rdx: number;
    eds: number;
    ifd: number;
  };
  rsl?: {
    rsl_control?: number;
    rsl_validation?: number;
    rsl_hypothesis?: number;
    rsl_expansion?: number;
  };
};

export function computeRfsFromPayload(payload: CognitiveRoleFitPayload): RfsJson {
  const inputs: StyleInputs = {
    aas: safe01(payload?.cff?.aas),
    ctf: safe01(payload?.cff?.ctf),
    rmd: safe01(payload?.cff?.rmd),
    rdx: safe01(payload?.cff?.rdx),
    eds: safe01(payload?.cff?.eds),
    ifd: safe01(payload?.cff?.ifd),

    rsl_control: safe01(payload?.rsl?.rsl_control ?? 0),
    rsl_validation: safe01(payload?.rsl?.rsl_validation ?? 0),
    rsl_hypothesis: safe01(payload?.rsl?.rsl_hypothesis ?? 0),
    rsl_expansion: safe01(payload?.rsl?.rsl_expansion ?? 0),
  };

  return computeRfs9Type(inputs);
}


/* =====================
   SOURCE: Backend_13_Job Role Fit top3.ts
   (verbatim from derive폴더.zip)
===================== */

/* =========================================================
   NeuPrint Job Role Fit (Group Top-3 Summary) v1.2 (TypeScript)
   - Deterministic, backend-safe
   - Compact output JSON that matches the UI-friendly "top group + % + role list" ask.

   Output JSON (valid JSON):
   {
     "rfs": {
       "top_groups": [
         {
           "group_name": "Strategy·Analysis·Policy",
           "percent": 78,
           "roles": [
             "Strategy Analyst",
             "Management Analyst",
             ...
           ]
         },
         ...
       ],
       "summary_lines": [
         "Strategy·Analysis·Policy: 78%",
         "Strategy·Analysis·Policy : Strategy Analyst, Management Analyst, .,
         "Data·AI·Intelligence: 74%",
         "Data·AI·Intelligence : Data Analyst, Data Scientist, .,
         "Engineering·Technology·Architecture: 68%",
         "Engineering·Technology·Architecture : Software Engineer, Systems Architect, .
       ]
     }
   }

   Scoring rule (kept intentionally simple):
   - Score each ROLE_CONFIG using:
       base = Σ(user_axis * weight_axis)
       arc_boost = small monotonic boost if user_arc >= min_arc (cap 0.04)
       final = clamp01(base + arc_boost)
   - Aggregate to GROUP score by max(final) among roles in the group
     (simple, stable, and avoids long per-role reporting).
   - Convert to percent by round(score * 100).

   IMPORTANT:
   - This file expects you to provide the roleConfigs array externally (DB or static list).
   - JOB_GROUPS is the canonical list of group -> jobs used for role list rendering.
   ========================================================= */

export type NeuprintAxes = {
  analyticity: number;   // 0..1
  flow: number;          // 0..1
  metacognition: number; // 0..1
  authenticity: number;  // 0..1
};

export type RoleConfig = {
  role_code: string;
  job_id: string;      // must exist in JOB_INDEX
  onet_code: string;
  oecd_core_skills: string[];
  neuprint_axes_weights: NeuprintAxes; // must sum to 1.0
  min_requirements: {
    arc_level: number;
    analyticity?: number;
    flow?: number;
    metacognition?: number;
    authenticity?: number;
  };
};

export type JobGroup = {
  group_id: number;
  group_name: string;
  job_id: string;
  job_name: string;
};

export type RoleFitInput = {
  axes: NeuprintAxes;
  arc_level: number;
};

export type RfsGroupItem = {
  group_name: string;
  percent: number; // 0..100
  roles: string[]; // job_name list (all jobs in group)
  recommended_role: string; // best-matching role name in this group
};

export type RfsGroupTop3Json = {
  rfs: {
    summary_lines: string[]; // e.g. ["Strategy·Analysis·Policy: 78%", ...]
    top_groups: RfsGroupItem[]; // e.g. [{group_name, percent, roles, recommended_role}, ...]
    recommended_roles_top3: string[]; // e.g. ["Strategy Analyst", "Data Scientist", "Systems Architect"]
    recommended_roles_line: string; // e.g. "Recommended roles include: ..."

    pattern_interpretation: string; // role-aligned narrative (Top1 group anchored)
  };
};
function isFiniteNumber(x: unknown): x is number {
  return typeof x === "number" && isFinite(x);
}

function isFinite01(x: number): boolean {
  return isFiniteNumber(x) && x >= 0 && x <= 1;
}

function assertAxes01(axes: NeuprintAxes, label: string): void {
  const keys: (keyof NeuprintAxes)[] = ["analyticity", "flow", "metacognition", "authenticity"];
  for (const k of keys) {
    const v = axes[k];
    if (!isFinite01(v)) throw new Error(`${label}.${String(k)} must be in [0,1]. Got: ${v}`);
  }
}

function validateWeights(weights: NeuprintAxes): void {
  assertAxes01(weights, "neuprint_axes_weights");
  const sum = weights.analyticity + weights.flow + weights.metacognition + weights.authenticity;
  const tol = 1e-6;
  if (Math.abs(sum - 1.0) > tol) {
    throw new Error(`neuprint_axes_weights must sum to 1.0. Got sum=${sum.toFixed(6)}`);
  }
}

/* ---------------------------------------------------------
   Job group index (canonical)
   NOTE: Copied from your provided file 그대로 유지
   --------------------------------------------------------- */
/* =========================
   Role-aligned interpretation
   - Deterministic narrative anchored to Top1 Role Group (15 groups)
   - Prevents mismatch between "interpretation" and recommended roles
========================= */

type Level3 = "HIGH" | "MEDIUM" | "LOW";

function level3(x: number): Level3 {
  const v = clamp01(x);
  if (v >= 0.67) return "HIGH";
  if (v >= 0.45) return "MEDIUM";
  return "LOW";
}

function levelWord(l: Level3): string {
  if (l === "HIGH") return "high";
  if (l === "MEDIUM") return "moderate";
  return "low";
}

function topAxes(axes: NeuprintAxes, k: number): Array<[keyof NeuprintAxes, number]> {
  const pairs: Array<[keyof NeuprintAxes, number]> = [
    ["analyticity", clamp01(axes.analyticity)],
    ["flow", clamp01(axes.flow)],
    ["metacognition", clamp01(axes.metacognition)],
    ["authenticity", clamp01(axes.authenticity)],
  ];
  return pairs.sort((a, b) => b[1] - a[1]).slice(0, Math.max(1, k));
}

function axisLabel(k: keyof NeuprintAxes): string {
  if (k === "analyticity") return "analytic precision";
  if (k === "flow") return "reasoning flow";
  if (k === "metacognition") return "reflective monitoring";
  return "authentic intent signaling";
}

const GROUP_ROLE_TEMPLATES: Record<number, (ctx: {
  group_name: string;
  percent: number;
  recommended_role: string;
  axes: NeuprintAxes;
  arc_level: number;
}) => string> = {
  1: () =>
    "Strong in conceptual structuring and strategic direction setting, this profile is well suited for designing large-scale frameworks and guiding decision alignment across complex constraints.",
  2: () =>
    "Demonstrates data-oriented reasoning with strong pattern extraction and hypothesis testing capacity, making it effective for analytical modeling and evidence-driven problem solving.",
  3: () =>
    "Shows strength in system architecture and technical integration thinking, enabling efficient translation of requirements into structured, scalable solutions.",
  4: () =>
    "Excels in problem framing and value-oriented design, combining user perspective with iterative experimentation to refine innovative solutions.",
  5: () =>
    "Strong in knowledge structuring and explanatory reasoning, supporting effective learning design, conceptual clarity, and instructional organization.",
  6: () =>
    "Demonstrates contextual interpretation and interpersonal sensitivity, enabling adaptive responses to human behavior and emotionally grounded decision processes.",
  7: () =>
    "Shows integrative decision-making ability across multiple priorities, supporting leadership roles that require coordination, resource alignment, and long-term direction setting.",
  8: () =>
    "Strong in persuasive communication and audience-oriented reasoning, enabling effective message framing, influence strategies, and engagement optimization.",
  9: () =>
    "Demonstrates expressive structuring ability, translating abstract ideas into concrete forms and experiences through visual and narrative organization.",
  10: () =>
    "Exhibits evidence-based judgment and risk-aware reasoning, supporting decision making in environments requiring accuracy, safety, and procedural reliability.",
  11: () =>
    "Strong in rule-based reasoning and logical consistency evaluation, enabling precise interpretation of requirements, regulations, and structured argumentation.",
  12: () =>
    "Shows process optimization and operational stability thinking, supporting efficient workflow design, quality management, and error prevention.",
  13: () =>
    "Demonstrates quantitative judgment and probabilistic reasoning, enabling structured evaluation of risk, return, and financial decision scenarios.",
  14: () =>
    "Strong in organizational dynamics interpretation and human system design, supporting talent development, cultural alignment, and team effectiveness.",
  15: () =>
    "Shows procedural structuring and automation-oriented reasoning, enabling efficient decomposition of tasks into repeatable and monitorable workflows.",
};


function buildRoleFitInterpretation(
  top1: { group_id: number; group_name: string; percent: number; recommended_role: string },
  input: RoleFitInput
): string {
  const fn = GROUP_ROLE_TEMPLATES[top1.group_id];
  if (!fn) {
    return `Role fit is most aligned with ${top1.group_name}, with strongest match for ${top1.recommended_role}.`;
  }
  return fn({
    group_name: top1.group_name,
    percent: top1.percent,
    recommended_role: top1.recommended_role,
    axes: input.axes,
    arc_level: input.arc_level,
  });
}


export const JOB_GROUPS: JobGroup[] = [
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "strategy_analyst", job_name: "Strategy Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "management_analyst", job_name: "Management Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "policy_analyst", job_name: "Policy Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "economic_researcher", job_name: "Economic Researcher" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "financial_analyst", job_name: "Financial Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "risk_analyst", job_name: "Risk Analyst" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "compliance_officer", job_name: "Compliance Officer" },
  { group_id: 1, group_name: "Strategy·Analysis·Policy", job_id: "internal_auditor", job_name: "Internal Auditor" },

  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "data_analyst", job_name: "Data Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "data_scientist", job_name: "Data Scientist" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "business_intelligence_analyst", job_name: "Business Intelligence Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "machine_learning_analyst", job_name: "Machine Learning Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "statistician", job_name: "Statistician" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "operations_research_analyst", job_name: "Operations Research Analyst" },
  { group_id: 2, group_name: "Data·AI·Intelligence", job_id: "information_security_analyst", job_name: "Information Security Analyst" },

  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "software_engineer", job_name: "Software Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "systems_architect", job_name: "Systems Architect" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "cloud_engineer", job_name: "Cloud Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "devops_engineer", job_name: "DevOps Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "network_architect", job_name: "Network Architect" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "qa_engineer", job_name: "QA Engineer" },
  { group_id: 3, group_name: "Engineering·Technology·Architecture", job_id: "safety_systems_engineer", job_name: "Safety Systems Engineer" },

  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "product_manager", job_name: "Product Manager" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "service_designer", job_name: "Service Designer" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "ux_planner", job_name: "UX Planner" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "business_developer", job_name: "Business Developer" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "innovation_manager", job_name: "Innovation Manager" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "r_and_d_planner", job_name: "R&D Planner" },
  { group_id: 4, group_name: "Product·Service·Innovation", job_id: "new_venture_strategist", job_name: "New Venture Strategist" },

  { group_id: 5, group_name: "Education·Research·Training", job_id: "teacher", job_name: "Teacher" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "professor", job_name: "Professor" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "instructional_designer", job_name: "Instructional Designer" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "education_consultant", job_name: "Education Consultant" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "research_scientist", job_name: "Research Scientist" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "research_coordinator", job_name: "Research Coordinator" },
  { group_id: 5, group_name: "Education·Research·Training", job_id: "academic_advisor", job_name: "Academic Advisor" },

  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "counselor", job_name: "Counselor" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "clinical_psychologist", job_name: "Clinical Psychologist" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "school_psychologist", job_name: "School Psychologist" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "social_worker", job_name: "Social Worker" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "behavioral_therapist", job_name: "Behavioral Therapist" },
  { group_id: 6, group_name: "Psychology·Counseling·Social Care", job_id: "rehabilitation_specialist", job_name: "Rehabilitation Specialist" },

  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "ceo_coo_cso", job_name: "CEO / COO / CSO" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "public_policy_director", job_name: "Public Policy Director" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "government_administrator", job_name: "Government Administrator" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "program_director", job_name: "Program Director" },
  { group_id: 7, group_name: "Leadership·Executive·Public Governance", job_id: "public_strategy_lead", job_name: "Public Strategy Lead" },

  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "marketing_strategist", job_name: "Marketing Strategist" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "brand_manager", job_name: "Brand Manager" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "sales_director", job_name: "Sales Director" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "pr_manager", job_name: "PR Manager" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "communication_manager", job_name: "Communication Manager" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "media_planner", job_name: "Media Planner" },
  { group_id: 8, group_name: "Marketing·Sales·Communication", job_id: "digital_marketer", job_name: "Digital Marketer" },

  { group_id: 9, group_name: "Design·Content·Media", job_id: "ux_ui_designer", job_name: "UX/UI Designer" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "graphic_designer", job_name: "Graphic Designer" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "video_producer", job_name: "Video Producer" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "content_strategist", job_name: "Content Strategist" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "creative_director", job_name: "Creative Director" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "editor", job_name: "Editor" },
  { group_id: 9, group_name: "Design·Content·Media", job_id: "multimedia_artist", job_name: "Multimedia Artist" },

  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "physician", job_name: "Physician" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "nurse", job_name: "Nurse" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "medical_researcher", job_name: "Medical Researcher" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "clinical_data_manager", job_name: "Clinical Data Manager" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "biomedical_scientist", job_name: "Biomedical Scientist" },
  { group_id: 10, group_name: "Healthcare·Life Science", job_id: "public_health_analyst", job_name: "Public Health Analyst" },

  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "lawyer", job_name: "Lawyer" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "legal_researcher", job_name: "Legal Researcher" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "compliance_manager", job_name: "Compliance Manager" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "ethics_officer", job_name: "Ethics Officer" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "regulatory_affairs_specialist", job_name: "Regulatory Affairs Specialist" },
  { group_id: 11, group_name: "Law·Compliance·Ethics", job_id: "contract_specialist", job_name: "Contract Specialist" },

  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "operations_manager", job_name: "Operations Manager" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "quality_manager", job_name: "Quality Manager" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "safety_engineer", job_name: "Safety Engineer" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "process_analyst", job_name: "Process Analyst" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "supply_chain_analyst", job_name: "Supply Chain Analyst" },
  { group_id: 12, group_name: "Operations·Quality·Safety·Logistics", job_id: "logistics_planner", job_name: "Logistics Planner" },

  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "investment_analyst", job_name: "Investment Analyst" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "portfolio_manager", job_name: "Portfolio Manager" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "credit_analyst", job_name: "Credit Analyst" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "actuary", job_name: "Actuary" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "insurance_underwriter", job_name: "Insurance Underwriter" },
  { group_id: 13, group_name: "Finance·Investment·Insurance", job_id: "treasury_manager", job_name: "Treasury Manager" },

  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "hr_manager", job_name: "HR Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "talent_manager", job_name: "Talent Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "organizational_development_manager", job_name: "Organizational Development Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "culture_manager", job_name: "Culture Manager" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "recruiter", job_name: "Recruiter" },
  { group_id: 14, group_name: "Culture·HR·Organization", job_id: "learning_and_development_specialist", job_name: "Learning & Development Specialist" },

  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "rpa_agent", job_name: "RPA Agent" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "chatbot_operator", job_name: "Chatbot Operator" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "automated_qa_bot", job_name: "Automated QA Bot" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "report_generation_agent", job_name: "Report Generation Agent" },
  { group_id: 15, group_name: "Automation·Digital Agent", job_id: "monitoring_ai", job_name: "Monitoring AI" },
];

export const JOB_INDEX: Record<string, JobGroup> = (() => {
  const map: Record<string, JobGroup> = {};
  for (const j of JOB_GROUPS) map[j.job_id] = j;
  return map;
})();

function computeArcBoost(userArc: number, minArc: number): number {
  if (!isFiniteNumber(userArc) || !isFiniteNumber(minArc)) return 0;
  if (userArc < minArc) return 0;
  const delta = userArc - minArc; // 0,1,2...
  const boost = Math.min(0.04, 0.02 + 0.01 * Math.max(0, delta - 1));
  return clamp01(boost);
}

function checkMinRequirements(input: RoleFitInput, cfg: RoleConfig): boolean {
  if (input.arc_level < cfg.min_requirements.arc_level) return false;
  const req = cfg.min_requirements;
  const a = input.axes;

  if (typeof req.analyticity === "number" && a.analyticity < req.analyticity) return false;
  if (typeof req.flow === "number" && a.flow < req.flow) return false;
  if (typeof req.metacognition === "number" && a.metacognition < req.metacognition) return false;
  if (typeof req.authenticity === "number" && a.authenticity < req.authenticity) return false;

  return true;
}

function scoreRoleFit01(input: RoleFitInput, cfg: RoleConfig): number {
  assertAxes01(input.axes, "input.axes");
  validateWeights(cfg.neuprint_axes_weights);

  const w = cfg.neuprint_axes_weights;
  const a = input.axes;

  const base =
    a.analyticity * w.analyticity +
    a.flow * w.flow +
    a.metacognition * w.metacognition +
    a.authenticity * w.authenticity;

  const boost = computeArcBoost(input.arc_level, cfg.min_requirements.arc_level);

  return clamp01(base + boost);
}

function rolesInGroup(groupName: string): string[] {
  return JOB_GROUPS.filter((j) => j.group_name === groupName).map((j) => j.job_name);
}

/**
 * Compute Top-3 GROUPS for UI summary.
 *
 * Group score aggregation:
 * - Among roles in the same group, take the maximum final role score (0..1).
 *   This keeps the group score interpretable and stable.
 */
export function computeRfsJobGroupTop3(
  input: RoleFitInput,
  roleConfigs: RoleConfig[],
  opts?: { strictMinFilter?: boolean }
): RfsGroupTop3Json {
  const strict = opts?.strictMinFilter ?? true;

  // Score each role config and map to group.
  const roleScored = roleConfigs.map((cfg) => {
    const job = JOB_INDEX[cfg.job_id];
    if (!job) throw new Error(`RoleConfig.job_id not found in JOB_INDEX: ${cfg.job_id}`);

    const ok = checkMinRequirements(input, cfg);
    const score = scoreRoleFit01(input, cfg);

    return {
      cfg,
      group_name: job.group_name,
      job_name: job.job_name,
      ok,
      score,
    };
  });

  const pool = strict ? roleScored.filter((x) => x.ok) : roleScored;
  const finalPool = pool.length > 0 ? pool : roleScored; // fallback when strict filter removes all

  // Aggregate by group: max score among roles in group
  const groupMax: Record<string, number> = {};
  const groupBestRole: Record<string, string> = {};
  for (const r of finalPool) {
    const prev = groupMax[r.group_name];
    if (typeof prev !== "number" || r.score > prev) {
      groupMax[r.group_name] = r.score;
      groupBestRole[r.group_name] = r.job_name;
    }
  }

  // Build sortable list
  const groups = Object.keys(groupMax).map((group_name) => {
    const s = clamp01(groupMax[group_name]);
    return { group_name, score_0to1: s };
  });

  // Sort desc, deterministic tie-breaker
  groups.sort((a, b) => {
    if (b.score_0to1 !== a.score_0to1) return b.score_0to1 - a.score_0to1;
    return a.group_name.localeCompare(b.group_name);
  });

  const top3 = groups.slice(0, 3);

  // summary_lines: "Group: XX%"
  const summary_lines = top3.map((g) => `${g.group_name}: ${Math.round(g.score_0to1 * 100)}%`);

  // top_groups: group_name + percent + roles + recommended_role
  const top_groups: RfsGroupItem[] = top3.map((g) => {
    const percent = Math.round(g.score_0to1 * 100);
    const roles = rolesInGroup(g.group_name);
    const recommended_role = groupBestRole[g.group_name] ?? roles[0] ?? g.group_name;
    return {
      group_name: g.group_name,
      percent,
      roles,
      recommended_role,
    };
  });

  const recommended_roles_top3 = top_groups.map((g) => g.recommended_role);
  const recommended_roles_line = `Recommended roles include: ${recommended_roles_top3.join(", ")}.`;

  let top1GroupId = 0;
  if (top_groups[0]) {
    for (const j of JOB_GROUPS) {
      if (j.group_name === top_groups[0].group_name) {
        top1GroupId = j.group_id;
        break;
      }
    }
  }

  const top1 = top_groups[0]
    ? {
        group_id: top1GroupId,
        group_name: top_groups[0].group_name,
        percent: top_groups[0].percent,
        recommended_role: top_groups[0].recommended_role,
      }
    : { group_id: 0, group_name: "", percent: 0, recommended_role: "" };

  const pattern_interpretation = top1.group_id ? buildRoleFitInterpretation(top1, input) : "";

  return {
    rfs: {
      summary_lines: [...summary_lines, recommended_roles_line],
      top_groups,
      recommended_roles_top3,
      recommended_roles_line,
      pattern_interpretation,
    },
  };
}

/* =====================
   deriveRfs orchestrator
===================== */
export type DeriveRfsInput = any;

export function deriveRfs(input: DeriveRfsInput): Record<string, any> {
  const ai = (input && typeof input === "object" && "analysis_input" in input)
    ? (input as any).analysis_input
    : input;

  const raw = ai?.raw_features ?? ai?.raw ?? ai?.rawFeatures ?? ai?.raw_features_v1 ?? ai?.raw_features_v2;

  // Cognitive style summary expects style inputs; most pipelines feed it derived CFF + rubric + raw.
  // If caller already has a style_inputs block, use it; else compute minimally from raw/rubric.
  const indicators = (input as any)?.cff?.indicators ?? ai?.cff?.indicators ?? {};
  const payload = {
    cff: {
      aas: Number(indicators?.AAS ?? indicators?.aas ?? 0),
      ctf: Number(indicators?.CTF ?? indicators?.ctf ?? 0),
      rmd: Number(indicators?.RMD ?? indicators?.rmd ?? 0),
      rdx: Number(indicators?.RDX ?? indicators?.rdx ?? 0),
      eds: Number(indicators?.EDS ?? indicators?.eds ?? 0),
      ifd: Number(indicators?.IFD ?? indicators?.ifd ?? 0),
    },
  };

  const style = computeRfsFromPayload(payload as any);

  // Job role fit: expects role configs. If caller provides role_configs, compute; else just return style output.
  const roleConfigs = Array.isArray(ai?.role_configs) ? ai.role_configs : [];
  const roleFit = (roleConfigs.length > 0)
    ? computeRfsJobGroupTop3((style as any)?.rfs ?? (ai?.rfs ?? {}), roleConfigs as any, { strictMinFilter: true })
    : null;

  if (roleFit) {
    return deepMergeAll(style, { rfs: roleFit as any });
  }
  return style;

  function buildStyleInputs(rawAny: any, rubricAny: any) {
    return {
      cff: ai?.cff ?? null,
      rsl_rubric: rubricAny ?? null,
      raw_features: rawAny ?? null
    };
  }

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
