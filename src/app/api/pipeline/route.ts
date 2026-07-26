import { NextResponse } from "next/server";
import { generateProjectId } from "@/lib/pipeline";
import type { VideoCategory } from "@/lib/types";
import { runPipelineTask } from "../../../../trigger/pipeline-task";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface PipelineBody {
  topic: string;
  category?: VideoCategory;
  speed?: number;
  channelName?: string;
}

export async function POST(req: Request) {
  let body: PipelineBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { topic, category = "biblica", speed = 1, channelName } = body;

  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return NextResponse.json(
      { error: "El tema debe tener al menos 3 caracteres." },
      { status: 400 }
    );
  }

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email ?? undefined;
  const videoId = `vid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  try {
    await runPipelineTask.trigger({
      videoId,
      topic: topic.trim(),
      category,
      speed,
      channelName,
      userEmail,
    });

    return NextResponse.json({ ok: true, videoId, message: "Pipeline enviado a Trigger.dev" });
  } catch (err: any) {
    console.error("[/api/pipeline] error triggering task:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error al lanzar el pipeline." },
      { status: 500 }
    );
  }
}
