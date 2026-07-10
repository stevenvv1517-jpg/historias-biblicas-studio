import fs from "node:fs/promises";
import path from "node:path";
import { getHistory } from "./history";
import { META_DIR } from "./paths";

export interface AdminUser {
  email: string;
  name: string;
  firstSignIn: string;
  lastSignIn: string;
  subscription: "free" | "premium";
  totalVideos: number;
}

export interface AdminStats {
  totalUsers: number;
  newUsersThisMonth: number;
  totalVideos: number;
  videosThisMonth: number;
  subscribers: number;
  users: AdminUser[];
}

const USERS_FILE = path.join(META_DIR, "users.json");

async function ensureUsersFile(): Promise<void> {
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
    await fs.writeFile(USERS_FILE, "[]", "utf-8");
  }
}

export async function getUsers(): Promise<AdminUser[]> {
  await ensureUsersFile();
  try {
    const data = await fs.readFile(USERS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function addUserSession(
  email: string,
  name: string
): Promise<void> {
  const users = await getUsers();
  const now = new Date().toISOString();
  const existing = users.find((u) => u.email === email);

  if (existing) {
    existing.lastSignIn = now;
  } else {
    users.push({
      email,
      name,
      firstSignIn: now,
      lastSignIn: now,
      subscription: "free",
      totalVideos: 0,
    });
  }

  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

export async function getStats(): Promise<AdminStats> {
  const users = await getUsers();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const adminEmail = process.env.ADMIN_EMAIL;
  const filtered = adminEmail ? users.filter((u) => u.email !== adminEmail) : users;

  const enriched = await Promise.all(
    filtered.map(async (user) => {
      const history = await getHistory(user.email);
      const totalVideos = history.length;
      return { ...user, totalVideos };
    })
  );

  const totalVideos = enriched.reduce((sum, u) => sum + u.totalVideos, 0);

  const newUsersThisMonth = enriched.filter(
    (u) => u.firstSignIn >= monthStart
  ).length;

  const videosThisMonth = (
    await Promise.all(
      enriched.map(async (u) => {
        const history = await getHistory(u.email);
        return history.filter((h) => h.createdAt >= monthStart).length;
      })
    )
  ).reduce((a, b) => a + b, 0);

  return {
    totalUsers: enriched.length,
    newUsersThisMonth,
    totalVideos,
    videosThisMonth,
    subscribers: enriched.filter((u) => u.subscription === "premium").length,
    users: enriched,
  };
}
