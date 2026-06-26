import fs from "node:fs/promises";
import path from "node:path";
import { publicToDisk } from "./paths";

export interface ConcatChunk {
  path: string;
  startSec: number;
  durationSec: number;
}

export interface ConcatResult {
  path: string;
  durationSec: number;
  chunks: ConcatChunk[];
}

export function estimateMp3Duration(bytes: number): number {
  return Math.max(1, Number((bytes / 12000).toFixed(2)));
}

export async function getMp3Duration(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return estimateMp3Duration(stat.size);
  } catch {
    return 0;
  }
}

export async function concatenateMp3s(
  sources: { path: string }[],
  outputPath: string
): Promise<{ path: string; chunks: ConcatChunk[] }> {
  const diskOutput = publicToDisk(outputPath);
  await fs.mkdir(path.dirname(diskOutput), { recursive: true });

  const buffers: Buffer[] = [];
  let cursorSec = 0;
  const chunks: ConcatChunk[] = [];

  for (const src of sources) {
    const diskSrc = publicToDisk(src.path);
    const buf = await fs.readFile(diskSrc);
    const dur = estimateMp3Duration(buf.length);
    buffers.push(buf);
    chunks.push({ path: src.path, startSec: cursorSec, durationSec: dur });
    cursorSec += dur;
  }

  const combined = Buffer.concat(buffers);
  await fs.writeFile(diskOutput, combined);

  return { path: outputPath, chunks };
}
