import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

// ============================================================
//  Utilidades de procesamiento de video con FFmpeg.
//  Requiere que FFmpeg esté instalado en el sistema (PATH).
//
//  Funciones:
//   - probeDuration(): obtiene duración de un video.
//   - trimVideo(): recorta un segmento (start → end).
//   - mixMusic(): mezcla música de fondo al 12% sobre el clip.
// ============================================================

/** Verifica que FFmpeg está disponible. Lanza error si no. */
async function ensureFfmpeg(): Promise<string> {
  const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();
  const candidates = [
    "ffmpeg",
    path.join(projectRoot, "node_modules", "@ffmpeg-installer", "win32-x64", "ffmpeg.exe"),
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
    "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
    path.join(process.env.LOCALAPPDATA ?? "", "Microsoft", "WinGet", "Links", "ffmpeg.exe"),
  ];

  for (const cmd of candidates) {
    try {
      const { stdout } = await execFileAsync(cmd, ["-version"], {
        windowsHide: true,
        timeout: 5000,
      });
      if (stdout.includes("ffmpeg version")) return cmd;
    } catch {
      continue;
    }
  }

  throw new Error(
    "FFmpeg no encontrado. Instálalo con: winget install ffmpeg  o descárgalo de https://ffmpeg.org/download.html y agrégalo al PATH."
  );
}

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  codec: string;
}

/** Busca ffprobe en las mismas rutas que ffmpeg. */
async function ensureFfprobe(ffmpegPath: string): Promise<string> {
  // Si ffmpeg es el del paquete npm, ffprobe está al lado
  const dir = path.dirname(ffmpegPath);
  const sibling = path.join(dir, "ffprobe.exe");
  try {
    await fs.access(sibling);
    return sibling;
  } catch {}
  // Buscar en ubicaciones conocidas
  const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();
  const np = path.join(projectRoot, "node_modules", "@ffprobe-installer", "win32-x64", "ffprobe.exe");
  try {
    await fs.access(np);
    return np;
  } catch {}
  return "ffprobe";
}

/** Obtiene metadatos del video (duración, resolución). */
export async function probeVideo(inputPath: string): Promise<ProbeResult> {
  const ffmpeg = await ensureFfmpeg();
  const ffprobe = await ensureFfprobe(ffmpeg);

  const { stdout } = await execFileAsync(
    ffprobe,
    [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ],
    { windowsHide: true, timeout: 30000, maxBuffer: 5 * 1024 * 1024 }
  );

  const json: any = JSON.parse(stdout);
  const videoStream = (json?.streams ?? []).find((s: any) => s.codec_type === "video");
  const duration = Number(json?.format?.duration ?? 0);

  return {
    durationSec: Math.round(duration * 100) / 100,
    width: Number(videoStream?.width ?? 0),
    height: Number(videoStream?.height ?? 0),
    codec: videoStream?.codec_name ?? "unknown",
  };
}

interface TrimOptions {
  inputPath: string;
  outputPath: string;
  startTimeSec: number;
  endTimeSec: number;
}

/** Recorta un segmento del video (start → end) con re-encode para precisión de frames. */
export async function trimVideo({
  inputPath,
  outputPath,
  startTimeSec,
  endTimeSec,
}: TrimOptions): Promise<void> {
  const ffmpeg = await ensureFfmpeg();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-i", inputPath,
      "-ss", String(startTimeSec),
      "-to", String(endTimeSec),
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "18",
      "-c:a", "aac",
      "-b:a", "128k",
      outputPath,
    ],
    { windowsHide: true, timeout: 120000 }
  );
}

interface MixMusicOptions {
  /** Clip de video (con audio original). */
  videoPath: string;
  /** Archivo de música mp3. */
  musicPath: string;
  /** Ruta de salida del video con música mezclada. */
  outputPath: string;
  /** Volumen de la música (0..1). Default 0.12. */
  musicVolume?: number;
}

/** Mezcla música de fondo con el audio del clip usando amix. */
export async function mixMusic({
  videoPath,
  musicPath,
  outputPath,
  musicVolume = 0.12,
}: MixMusicOptions): Promise<void> {
  const ffmpeg = await ensureFfmpeg();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-i", videoPath,
      "-i", musicPath,
      "-filter_complex",
      `[1:a]volume=${musicVolume}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=3`,
      "-c:v", "copy",
      "-c:a", "aac",
      "-b:a", "128k",
      "-shortest",
      outputPath,
    ],
    { windowsHide: true, timeout: 120000 }
  );
}

/** Extrae solo el audio de un clip como mp3 (para enviarlo a Deepgram). */
export async function extractAudio(
  videoPath: string,
  outputPath: string
): Promise<void> {
  const ffmpeg = await ensureFfmpeg();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await execFileAsync(
    ffmpeg,
    [
      "-y",
      "-i", videoPath,
      "-vn",
      "-acodec", "libmp3lame",
      "-q:a", "2",
      outputPath,
    ],
    { windowsHide: true, timeout: 60000 }
  );
}

/** Lista los archivos .mp3 de /public/assets/music/. */
export async function listMusicFiles(): Promise<string[]> {
  const musicDir = path.join(process.cwd(), "public", "assets", "music");
  try {
    const files = await fs.readdir(musicDir);
    return files.filter((f) => f.endsWith(".mp3")).map((f) => `/assets/music/${f}`);
  } catch {
    return [];
  }
}
