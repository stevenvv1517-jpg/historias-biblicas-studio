import fs from "node:fs/promises";
import path from "node:path";

// ============================================================
//  Cliente Cloudflare Workers AI
//   - Flux text-to-image  (@cf/black-forest-labs/flux-2-flex)
//   - Flux image-to-video (animación) (@cf/bytedance/stable-diffusion-xl)
//   - safety_tolerance: 5 (max permisivo, evita falsos NSFW)
// ============================================================

export interface FluxGenerateParams {
  prompt: string;
  outputPath: string; // ruta absoluta .png
}

export interface FluxGenerateResult {
  path: string;
  bytes: number;
}

export interface FluxAnimateParams {
  imagePath: string;
  prompt: string;
  outputPath: string; // ruta absoluta .mp4
  durationSec?: number; // duración en segundos (default 4)
}

export interface FluxAnimateResult {
  path: string;
  bytes: number;
  durationSec: number;
}

function getAuth() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId)
    throw new Error("Faltan CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID.");
  return { token, accountId };
}

async function cloudflareFetch(model: string, body: any): Promise<Buffer> {
  const { token, accountId } = getAuth();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudflare ${model} ${res.status}: ${errText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json: any = await res.json();
    const b64 = json?.result?.image ?? json?.image ?? json?.video;
    if (b64) return Buffer.from(b64, "base64");
    throw new Error(`Cloudflare ${model}: respuesta sin datos binarios.`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Genera una imagen vertical 9:16 con Flux vía API REST de Cloudflare.
 * Documentación: https://developers.cloudflare.com/workers-ai/models/flux/
 */
export async function generateFluxImage({
  prompt,
  outputPath,
}: FluxGenerateParams): Promise<FluxGenerateResult> {
  const model =
    process.env.CLOUDFLARE_FLUX_MODEL ?? "@cf/black-forest-labs/flux-2-flex";

  const buf = await cloudflareFetch(model, {
    prompt,
    guidance: 7,
    num_inference_steps: 16,
    safety_tolerance: 5,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buf);
  return { path: outputPath, bytes: buf.length };
}

/**
 * Anima una imagen generada por Flux usando el modelo de animación de Cloudflare.
 * Convierte una imagen estática en un video corto con movimiento sutil.
 */
export async function animateFluxImage({
  imagePath,
  prompt,
  outputPath,
  durationSec = 4,
}: FluxAnimateParams): Promise<FluxAnimateResult> {
  const model =
    process.env.CLOUDFLARE_ANIMATE_MODEL ?? "@cf/bytedance/stable-diffusion-xl";

  const imageBuf = await fs.readFile(imagePath);
  const base64Image = imageBuf.toString("base64");

  const buf = await cloudflareFetch(model, {
    image: base64Image,
    prompt,
    guidance: 7,
    safety_tolerance: 5,
    num_frames: Math.round(durationSec * 8),
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buf);
  return { path: outputPath, bytes: buf.length, durationSec };
}
