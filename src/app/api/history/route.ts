import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHistory, deleteFromHistory } from "@/lib/history";
import { getB2Config, getSignedDownloadUrl } from "@/lib/b2";

export const runtime = "nodejs";

async function getUserEmail(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? undefined;
}

export async function GET() {
  try {
    const email = await getUserEmail();
    const history = await getHistory(email);

    const enriched = await Promise.all(
      history.map(async (entry) => {
        if (!entry.remoteKey) return entry;
        try {
          getB2Config();
          const signedUrl = await getSignedDownloadUrl(entry.remoteKey, 604800);
          return { ...entry, b2Url: signedUrl };
        } catch {
          return entry;
        }
      })
    );

    return NextResponse.json({ ok: true, history: enriched });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error al leer historial" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const email = await getUserEmail();
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta id" }, { status: 400 });
    }
    const deleted = await deleteFromHistory(id, email);
    return NextResponse.json({ ok: true, deleted });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Error al eliminar" },
      { status: 500 }
    );
  }
}
