import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isAdmin } from "@/lib/auth";
import { getStats } from "@/lib/admin";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const stats = await getStats();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error al obtener stats" },
      { status: 500 }
    );
  }
}
