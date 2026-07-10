import fs from "node:fs/promises";
import path from "node:path";
import { META_DIR, isVercel } from "./paths";
import { readJsonFromB2, writeJsonToB2 } from "./b2";

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

function getHistoryKey(email?: string): string {
  const safe = email
    ? Buffer.from(email).toString("base64url").slice(0, 48)
    : "anonymous";
  return `meta/history_${safe}.json`;
}

function getHistoryLocalPath(email?: string): string {
  const safe = email
    ? Buffer.from(email).toString("base64url").slice(0, 48)
    : "anonymous";
  return path.join(META_DIR, `history_${safe}.json`);
}

async function getHistoryLocal(email?: string): Promise<HistoryEntry[]> {
  const file = getHistoryLocalPath(email);
  try {
    await fs.access(file).catch(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "[]", "utf-8");
    });
    const data = await fs.readFile(file, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveHistoryLocal(entries: HistoryEntry[], email?: string): Promise<void> {
  const file = getHistoryLocalPath(email);
  await fs.writeFile(file, JSON.stringify(entries, null, 2), "utf-8");
}

const historyCache = new Map<string, HistoryEntry[]>();

async function getHistoryB2(email?: string): Promise<HistoryEntry[]> {
  const key = email ?? "anonymous";
  const cached = historyCache.get(key);
  if (cached) return cached;
  const data = await readJsonFromB2<HistoryEntry[]>(getHistoryKey(email));
  const entries = data ?? [];
  historyCache.set(key, entries);
  return entries;
}

async function saveHistoryB2(entries: HistoryEntry[], email?: string): Promise<void> {
  const key = email ?? "anonymous";
  historyCache.set(key, entries);
  await writeJsonToB2(getHistoryKey(email), entries);
}

export async function getHistory(email?: string): Promise<HistoryEntry[]> {
  if (isVercel) return getHistoryB2(email);
  return getHistoryLocal(email);
}

export async function addToHistory(
  entry: HistoryEntry,
  email?: string
): Promise<void> {
  const history = await getHistory(email);
  history.unshift(entry);
  if (isVercel) await saveHistoryB2(history, email);
  else await saveHistoryLocal(history, email);
}

export async function deleteFromHistory(
  id: string,
  email?: string
): Promise<boolean> {
  const history = await getHistory(email);
  const filtered = history.filter((e) => e.id !== id);
  if (filtered.length === history.length) return false;
  if (isVercel) await saveHistoryB2(filtered, email);
  else await saveHistoryLocal(filtered, email);
  return true;
}
