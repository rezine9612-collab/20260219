// app/api/analyze/route.ts

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { derive } from "@/lib/server/derive";

// Static import to avoid Vercel/serverless filesystem pitfalls.
import fixture from "@/lib/fixtures/fixture_analysis_input_v1.json";

type AnalysisEnvelope = {
  analysis_input: any;
  narrative_text?: {
    rsl?: {
      summary?: { one_line?: string; paragraph?: string };
      dimensions?: Array<{
        code: string;
        label?: string;
        score_1to5?: number;
        observation?: string;
      }>;
    };
  };
  meta?: { input_language?: string };
};

function generateVerificationIdV1(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear().toString();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");

  const seq = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `NP-${yyyy}-${mm}${dd}-${seq}`;
}

function buildMeta(envelope: AnalysisEnvelope) {
  return {
    input_language: envelope.meta?.input_language ?? "EN",
    generated_at_utc: new Date().toISOString(),
    verify_url: process.env.NP_VERIFY_URL ?? "https://neuprint.ai/verify",
    verification_id: generateVerificationIdV1(),
  };
}

export async function POST(_req: Request) {
  // Fixture-first MVP: ignore request body for now.
  const envelope = fixture as unknown as AnalysisEnvelope;

  // Derive expects analysis_input
  const derived = derive(envelope.analysis_input);

  // Merge narrative RSL text from fixture into derived output
  const narrativeRsl = envelope.narrative_text?.rsl;

  const report = {
    meta: buildMeta(envelope),
    ...derived,
    rsl: {
      ...(derived as any).rsl,
      summary: {
        one_line:
          narrativeRsl?.summary?.one_line ??
          (derived as any).rsl?.summary?.one_line ??
          "",
        paragraph:
          narrativeRsl?.summary?.paragraph ??
          (derived as any).rsl?.summary?.paragraph ??
          "",
      },
      dimensions: Array.isArray(narrativeRsl?.dimensions)
        ? narrativeRsl!.dimensions
        : (derived as any).rsl?.dimensions ?? [],
    },
  };

  return NextResponse.json(report);
}
