import fs from "node:fs/promises";
import path from "node:path";

const LMNT_CHAR_LIMIT = 4800;
const LMNT_BYTES_PER_SEC = 12000;

async function synthesizeChunk(text: string, voice: string, format: "mp3" | "wav", speed: number): Promise<Buffer> {
  const apiKey = process.env.LMNT_API_KEY;
  if (!apiKey) throw new Error("Falta LMNT_API_KEY en el entorno.");

  const res = await fetch("https://api.lmnt.com/v1/ai/speech/bytes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "lmnt-version": "1.2",
    },
    body: JSON.stringify({ text, voice, format, speed }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LMNT ${res.status}: ${errText}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function synthesizeLmnt({
  text,
  voice,
  format = "mp3",
  speed = 1,
  outputPath,
}: {
  text: string;
  voice: string;
  format?: "mp3" | "wav";
  speed?: number;
  outputPath: string;
}): Promise<{ path: string; durationSec: number; bytes: number }> {
  const resolvedVoice = process.env.LMNT_VOICE_ID?.trim() || voice;

  const chunks: Buffer[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    let chunk = remaining.slice(0, LMNT_CHAR_LIMIT);
    const boundary = chunk.lastIndexOf(". ");
    if (boundary > 0 && remaining.length > LMNT_CHAR_LIMIT) {
      chunk = remaining.slice(0, boundary + 1);
    }
    const buf = await synthesizeChunk(chunk, resolvedVoice, format, speed);
    chunks.push(buf);
    remaining = remaining.slice(chunk.length).trimStart();
  }

  const combined = Buffer.concat(chunks);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, combined);

  const durationSec = Math.max(1, Number((combined.length / LMNT_BYTES_PER_SEC).toFixed(2)));

  return { path: outputPath, durationSec, bytes: combined.length };
}
