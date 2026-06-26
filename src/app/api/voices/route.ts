import { NextResponse } from "next/server";
import { LMNT_VOICES } from "@/lib/voices";

// Endpoint simple que expone el catálogo de voces a la UI.
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ voices: LMNT_VOICES });
}
