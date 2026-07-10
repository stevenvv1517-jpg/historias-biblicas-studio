import { NextResponse } from "next/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { RemotionInputProps, ClipEmotivoInputProps } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

interface RenderBody {
  inputProps: RemotionInputProps | ClipEmotivoInputProps;
  totalDurationSec: number;
  compositionId?: string;
}

async function getUserEmail(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return session?.user?.email ?? undefined;
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

  const videoId = `vid_${Date.now().toString(36)}`;
  const compositionId = body.compositionId ?? "MainVideo";

  try {
    console.log(`[/api/render] lanzando render en Trigger.dev…`);

    const handle = await tasks.trigger<"render-video">("render-video", {
      inputProps: body.inputProps as any,
      totalDurationSec: body.totalDurationSec,
      compositionId,
      videoId,
    });

    console.log(`[/api/render] tarea lanzada: ${handle.id}`);

    return NextResponse.json({
      ok: true,
      taskId: handle.id,
      videoId,
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
