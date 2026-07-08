import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { publicToDisk, projectRoot } from "@/lib/paths";
import { uploadToB2, getB2Config } from "@/lib/b2";
import { addToHistory } from "@/lib/history";
import type { RemotionInputProps, ClipEmotivoInputProps } from "@/lib/types";

export const runtime = "nodejs";

const FFMPEG_DIR = path.join(projectRoot, "node_modules", "@ffmpeg-installer", "win32-x64");
process.env.PATH = `${FFMPEG_DIR}${path.delimiter}${process.env.PATH}`;
export const maxDuration = 600;

let cachedServeUrl: string | null = null;

async function getBundle() {
  if (!cachedServeUrl) {
    cachedServeUrl = await bundle({
      entryPoint: path.join(projectRoot, "remotion-app", "index.tsx"),
      onProgress: (p) => console.log(`[remotion bundle] ${p}%`),
    });
  }
  return cachedServeUrl;
}

async function syncAssetsToBundle(serveUrl: string) {
  let bundleFile: string;
  try {
    bundleFile = fileURLToPath(serveUrl);
  } catch {
    bundleFile = serveUrl;
  }
  const bundleDir = bundleFile.endsWith("index.html")
    ? path.dirname(bundleFile)
    : bundleFile.replace(/[/\\]$/, "");

  const assetsSrc = path.join(projectRoot, "public", "assets");
  const assetsDst = path.join(bundleDir, "assets");

  console.log(`[render] copiando assets:\n  origen: ${assetsSrc}\n  destino: ${assetsDst}`);

  try {
    const srcExists = await fs.stat(assetsSrc).then(() => true).catch(() => false);
    if (!srcExists) {
      console.warn(`[render] origen de assets no existe: ${assetsSrc}`);
      return;
    }
    await fs.cp(assetsSrc, assetsDst, { recursive: true, force: true });
    const files = await fs.readdir(assetsDst).catch(() => []);
    console.log(`[render] assets copiados (${files.length} subdirectorios): ${assetsDst}`);
  } catch (err) {
    console.warn("[render] No se pudieron copiar assets al bundle:", err);
  }
}

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
  const outputPublicPath = `/assets/videos/${videoId}.mp4`;
  const outputDiskPath = publicToDisk(outputPublicPath);

  try {
    console.log("[/api/render] empaquetando bundle de Remotion…");
    const serveUrl = await getBundle();

    await syncAssetsToBundle(serveUrl);

    const compositionId = body.compositionId ?? "MainVideo";
    console.log(`[/api/render] seleccionando composición ${compositionId}…`);
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: body.inputProps as any,
    });

    const fps = composition.fps;
    const durationInFrames = Math.max(
      1,
      Math.round(body.totalDurationSec * fps)
    );

    console.log(
      `[/api/render] renderizando ${durationInFrames} frames @ ${fps}fps → ${outputDiskPath}`
    );
    await renderMedia({
      composition: { ...composition, durationInFrames },
      serveUrl,
      codec: "h264",
      outputLocation: outputDiskPath,
      imageFormat: "jpeg",
      crf: 18,
      audioCodec: "aac",
      onProgress: ({ progress }) =>
        process.stdout.write(
          `\r[/api/render] ${Math.round(progress * 100)}%`
        ),
    });
    process.stdout.write("\n");

    // ---- Subir a Backblaze B2 (bucket privado) ----
    let b2Uploaded = false;
    const meta = body.inputProps?.meta as Record<string, unknown> | undefined;
    const title = (meta?.title as string) ?? videoId;
    const category = (meta?.category as string) ?? "biblica";
    const scenes = (body.inputProps as any)?.scenes?.length ?? 0;
    const subtitles = (body.inputProps as any)?.subtitles?.length ?? 0;
    const remoteKey = `videos/${videoId}.mp4`;

    try {
      getB2Config();
      await uploadToB2(outputDiskPath, remoteKey);
      b2Uploaded = true;
      console.log(`[/api/render] subido a B2: ${remoteKey}`);
    } catch (b2Err: any) {
      console.warn("[/api/render] B2 no configurado, saltando subida:", b2Err?.message);
    }

    // ---- Guardar en historial ----
    const userEmail = await getUserEmail();
    if (b2Uploaded) {
      try {
        await addToHistory(
          {
            id: videoId,
            title,
            category,
            createdAt: new Date().toISOString(),
            durationSec: body.totalDurationSec,
            scenes,
            subtitles,
            remoteKey,
            b2Url: "",
            localPath: outputPublicPath,
          },
          userEmail
        );
      } catch (histErr: any) {
        console.warn("[/api/render] Error guardando historial:", histErr?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      videoPath: outputPublicPath,
      b2Uploaded,
      videoId,
      frames: durationInFrames,
      fps,
    });
  } catch (err: any) {
    console.error("[/api/render] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error de render" },
      { status: 500 }
    );
  }
}
