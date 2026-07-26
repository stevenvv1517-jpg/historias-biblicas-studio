import { NextResponse } from "next/server";
import { readJsonFromB2 } from "@/lib/b2";

export const runtime = "nodejs";

interface PipelineStatus {
  videoId: string;
  status: "processing" | "done" | "failed";
  createdAt?: string;
  stats?: Record<string, any>;
  error?: string;
}

export async function GET(
  _req: Request,
  { params }: { params: { videoId: string } }
) {
  const { videoId } = params;

  if (!videoId || videoId.length > 64) {
    return NextResponse.json({ error: "videoId inválido" }, { status: 400 });
  }

  try {
    const status = await readJsonFromB2<PipelineStatus>(
      `pipeline/${videoId}/status.json`
    );

    if (!status) {
      return NextResponse.json({ videoId, status: "processing" });
    }

    if (status.status === "done") {
      const projectData = await readJsonFromB2<{ project: any; stats: any }>(
        `pipeline/${videoId}/project.json`
      );

      return NextResponse.json({
        videoId,
        status: "done",
        project: projectData?.project ?? null,
        stats: projectData?.stats ?? status.stats ?? null,
      });
    }

    if (status.status === "failed") {
      return NextResponse.json({
        videoId,
        status: "failed",
        error: status.error ?? "Error desconocido",
      });
    }

    return NextResponse.json({ videoId, status: "processing" });
  } catch (err: any) {
    return NextResponse.json({ videoId, status: "processing" });
  }
}
