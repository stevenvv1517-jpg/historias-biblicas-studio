import { NextResponse } from "next/server";
import { renderVideoTask } from "../../../../trigger/render-video";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { RemotionInputProps, ClipEmotivoInputProps } from "@/lib/types";
import { getUserTier } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RenderBody {
  inputProps: RemotionInputProps | ClipEmotivoInputProps;
  totalDurationSec: number;
  compositionId?: string;
}

export async function POST(req: Request) {
  let body: RenderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body?.inputProps || !body.totalDurationSec) {
    return NextResponse.json(
      { error: "Faltan inputProps o totalDurationSec." },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email ?? "";
  const tier = await getUserTier(email);

  const videoId = `vid_${Date.now().toString(36)}`;
  const compositionId = body.compositionId ?? "MainVideo";
  const priority = tier === "premium" ? "high" : "normal";

  try {
    console.log(`[/api/render] lanzando render en Trigger.dev… tier=${tier} priority=${priority}`);

    const handle = await renderVideoTask.trigger({
      inputProps: body.inputProps as any,
      totalDurationSec: body.totalDurationSec,
      compositionId,
      videoId,
      priority,
    });

    console.log(`[/api/render] tarea lanzada: ${handle.id}`);

    return NextResponse.json({
      ok: true,
      taskId: handle.id,
      videoId,
      tier,
      priority,
      message: "Render lanzado en Trigger.dev",
    });
  } catch (err: any) {
    console.error("[/api/render] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error de render" },
      { status: 500 }
    );
  }
}
