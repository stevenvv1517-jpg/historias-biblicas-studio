import path from "node:path";

const projectRoot =
  process.env.PROJECT_ROOT ?? path.join(process.cwd());

const isVercel = !!process.env.VERCEL;

/** En Vercel solo /tmp es escribible; en local usamos la raíz del proyecto. */
const WRITABLE_ROOT = isVercel ? "/tmp" : projectRoot;

/** Directorio para activos generados (audio, imágenes, videos). */
export const DATA_DIR = path.join(WRITABLE_ROOT, "assets");

/** Directorio para metadatos de usuario (users.json, historial). */
export const META_DIR = WRITABLE_ROOT;

/** Convierte una ruta pública (/assets/x.png) en absoluta de disco. */
export function publicToDisk(publicPath: string): string {
  return path.join(DATA_DIR, publicPath.replace(/^\//, ""));
}

/** Genera una ruta pública única dentro de una subcarpeta. */
export function buildPublicAssetPath(
  folder: "audio" | "images" | "videos" | "sfx",
  filename: string
): string {
  return `/assets/${folder}/${filename}`;
}

/**
 * En producción (Vercel), los assets generados se sirven mediante
 * la API /api/files/... porque /tmp no es accesible directamente.
 * En local se sirven estáticamente desde /public.
 */
export function assetUrl(publicPath: string): string {
  if (process.env.VERCEL) {
    return `/api/files${publicPath}`;
  }
  return publicPath;
}

export { projectRoot };
