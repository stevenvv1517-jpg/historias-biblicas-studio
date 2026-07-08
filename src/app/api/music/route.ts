import { NextResponse } from "next/server";
import { listMusicFiles } from "@/lib/video-utils";

export const runtime = "nodejs";

// Devuelve la lista de pistas de música cristiana disponibles.
export async function GET() {
  const files = await listMusicFiles();
  return NextResponse.json({ tracks: files });
}
