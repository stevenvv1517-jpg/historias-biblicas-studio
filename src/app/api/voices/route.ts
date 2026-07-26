import { NextResponse } from "next/server";
import { EDGE_TTS_VOICES_CATALOG } from "@/lib/voices";

// Endpoint simple que expone el catálogo de voces a la UI.
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ voices: EDGE_TTS_VOICES_CATALOG });
}
