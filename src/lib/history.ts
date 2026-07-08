import fs from "node:fs/promises";
import path from "node:path";

export interface HistoryEntry {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  durationSec: number;
  scenes: number;
  subtitles: number;
  remoteKey: string;
  b2Url: string;
  localPath: string;
}

function getHistoryFile(email?: string): string {
  const safe = email
    ? Buffer.from(email).toString("base64url").slice(0, 48)
    : "anonymous";
  return path.join(process.cwd(), "public", "assets", `history_${safe}.json`);
}

async function ensureHistoryFile(email?: string): Promise<string> {
  const file = getHistoryFile(email);
  try {
    await fs.access(file);
  } catch {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "[]", "utf-8");
  }
  return file;
}

export async function getHistory(email?: string): Promise<HistoryEntry[]> {
  const file = await ensureHistoryFile(email);
  try {
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function addToHistory(
  entry: HistoryEntry,
  email?: string
): Promise<void> {
  const history = await getHistory(email);
  history.unshift(entry);
  const file = getHistoryFile(email);
  await fs.writeFile(file, JSON.stringify(history, null, 2), "utf-8");
}

export async function deleteFromHistory(
  id: string,
  email?: string
): Promise<boolean> {
  const history = await getHistory(email);
  const filtered = history.filter((e) => e.id !== id);
  if (filtered.length === history.length) return false;
  const file = getHistoryFile(email);
  await fs.writeFile(file, JSON.stringify(filtered, null, 2), "utf-8");
  return true;
}
