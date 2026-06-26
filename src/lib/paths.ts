import path from "node:path";

// ============================================================
//  Resolución de rutas absolutas hacia /public/assets
//  (donde el script de construcción descarga los activos generados).
//  Las rutas "públicas" que se pasan a Remotion son /assets/...
//  pero en disco se materializan en <project>/public/assets/...
// ============================================================

const projectRoot =
  process.env.PROJECT_ROOT ?? path.join(process.cwd());

export const PUBLIC_DIR = path.join(projectRoot, "public");
export const ASSETS_DIR = path.join(PUBLIC_DIR, "assets");

/** Convierte una ruta pública (/assets/x.png) en absoluta de disco. */
export function publicToDisk(publicPath: string): string {
  return path.join(PUBLIC_DIR, publicPath.replace(/^\//, ""));
}

/** Genera una ruta pública única dentro de una subcarpeta. */
export function buildPublicAssetPath(
  folder: "audio" | "images" | "videos" | "sfx",
  filename: string
): string {
  return `/assets/${folder}/${filename}`;
}

export { projectRoot };
