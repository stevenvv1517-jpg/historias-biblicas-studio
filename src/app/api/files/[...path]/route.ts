import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DATA_DIR = process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "public");

export async function GET(
  _req: Request,
  { params }: { params: { path: string[] } }
) {
  const filePath = params.path.join("/");
  const absolute = path.join(DATA_DIR, filePath);

  if (!absolute.startsWith(DATA_DIR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await fs.readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    const mime: Record<string, string> = {
      ".mp3": "audio/mpeg",
      ".mp4": "video/mp4",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".wav": "audio/wav",
      ".json": "application/json",
    };
    return new NextResponse(data, {
      headers: { "Content-Type": mime[ext] || "application/octet-stream" },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
