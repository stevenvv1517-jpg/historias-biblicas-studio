import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { publicToDisk, projectRoot } from "@/lib/paths";
import type { RemotionInputProps } from "@/lib/types";

export const runtime = "nodejs";
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
  // Si apunta directo a index.html, tomamos su directorio padre
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
  inputProps: RemotionInputProps;
  totalDurationSec: number;
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

    console.log("[/api/render] seleccionando composición MainVideo…");
    const composition = await selectComposition({
      serveUrl,
      id: "MainVideo",
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

    return NextResponse.json({
      ok: true,
      videoPath: outputPublicPath,
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
