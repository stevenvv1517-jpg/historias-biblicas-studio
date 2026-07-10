import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

// Orden de búsqueda: /tmp primero, luego /public
const SEARCH_DIRS = [
  process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "public"),
  path.join(process.cwd(), "public"),
];

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".wav": "audio/wav",
  ".webm": "video/webm",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } }
) {
  const filePath = params.path.join("/");

  for (const base of SEARCH_DIRS) {
    const absolute = path.join(base, filePath);
    if (!absolute.startsWith(base)) continue;

    try {
      const data = await fs.readFile(absolute);
      const ext = path.extname(absolute).toLowerCase();
      return new NextResponse(data, {
        headers: { "Content-Type": MIME[ext] || "application/octet-stream" },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
