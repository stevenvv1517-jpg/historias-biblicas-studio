import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { analyzeClipEmotion } from "@/lib/clients/clip-analysis";
import { transcribeDeepgram } from "@/lib/clients/deepgram";
import {
  probeVideo,
  trimVideo,
  extractAudio,
  listMusicFiles,
} from "@/lib/video-utils";
import {
  buildPopisSubtitles,
  secondsToFrames,
  FPS,
  generateProjectId,
} from "@/lib/pipeline";
import { publicToDisk } from "@/lib/paths";
import type {
  ClipEmotivoProject,
  ClipEmotivoPlayerConfig,
  EmotionalAnalysis,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// ============================================================
//  POST /api/clip-emotivo
//
//  Flujo:
//   1. Recibe FormData con el video + tema
//   2. Guarda el video original en /public/assets/videos/
//   3. Probing: obtiene duración y resolución
//   4. Groq: análisis emocional → startTime, endTime, título
//   5. FFmpeg: recorta el segmento más emotivo
//   6. FFmpeg: mezcla música cristiana de fondo (12% volumen)
//   7. Deepgram: transcribe el audio del clip → subtítulos Popis
//   8. Ensambla playerConfig para preview
//
//  Body (multipart/form-data):
//    - video: File (mp4, mov, avi, mkv)
//    - topic: string (tema/descripción del clip)
// ============================================================

export async function POST(req: Request) {
  const projectId = generateProjectId();
  const createdAt = new Date().toISOString();

  try {
    // ---------- 1) Recibir archivo y tema ----------
    const formData = await req.formData();
    const videoFile = formData.get("video") as File | null;
    const topic = (formData.get("topic") as string | null)?.trim();

    if (!videoFile) {
      return NextResponse.json({ error: "No se recibió ningún video." }, { status: 400 });
    }
    if (!topic || topic.length < 3) {
      return NextResponse.json({ error: "El tema debe tener al menos 3 caracteres." }, { status: 400 });
    }

    // Guardar video original.
    const originalFilename = videoFile.name;
    const originalDiskPath = publicToDisk(`/assets/videos/original_${projectId}${path.extname(originalFilename)}`);
    await fs.mkdir(path.dirname(originalDiskPath), { recursive: true });
    const videoBuf = Buffer.from(await videoFile.arrayBuffer());
    await fs.writeFile(originalDiskPath, videoBuf);

    // ---------- 2) Probing ----------
    const probe = await probeVideo(originalDiskPath);

    // ---------- 3) Análisis emocional (Groq) ----------
    const analysis: EmotionalAnalysis = await analyzeClipEmotion({
      topic,
      totalDurationSec: probe.durationSec,
      maxClipDuration: 60,
    });

    // ---------- 4) Recortar segmento ----------
    const trimmedDiskPath = publicToDisk(`/assets/videos/trimmed_${projectId}.mp4`);
    await trimVideo({
      inputPath: originalDiskPath,
      outputPath: trimmedDiskPath,
      startTimeSec: analysis.startTime,
      endTimeSec: analysis.endTime,
    });

    const publicTrimmedClip = `/assets/videos/trimmed_${projectId}.mp4`;

    // ---------- 5) Seleccionar música cristiana (Remotion la mezcla en tiempo real) ----------
    const musicFiles = await listMusicFiles();
    let musicPath = "";
    if (musicFiles.length > 0) {
      musicPath = musicFiles[Math.floor(Math.random() * musicFiles.length)];
    }

    // ---------- 6) Subtítulos (Deepgram) ----------
    const extractedAudioPath = publicToDisk(`/assets/audio/clip_${projectId}.mp3`);
    await extractAudio(trimmedDiskPath, extractedAudioPath);

    const { words, durationSec } = await transcribeDeepgram({
      audioPath: extractedAudioPath,
      language: "es",
      model: "nova-2",
    });
    const subtitles = buildPopisSubtitles(words);

    // ---------- 7) Ensamblar playerConfig ----------
    // El video de salida siempre es el recortado; la música la mezcla Remotion.

    const playerConfig: ClipEmotivoPlayerConfig = {
      compositionName: "ClipVideo",
      durationInFrames: secondsToFrames(durationSec || analysis.durationSec),
      fps: FPS,
      width: 1080,
      height: 1920,
      inputProps: {
        videoPath: publicTrimmedClip,
        musicPath,
        title: analysis.title,
        subtitles,
        totalDurationSec: durationSec || analysis.durationSec,
        colorGrading: analysis.colorGrading,
        meta: {
          category: "clip-emotivo",
          originalFilename,
        },
      },
    };

    const project: ClipEmotivoProject = {
      id: projectId,
      createdAt,
      analysis,
      originalPath: `/assets/videos/original_${projectId}${path.extname(originalFilename)}`,
      finalClipPath: publicTrimmedClip,
      trimmedClipPath: publicTrimmedClip,
      musicPath,
      subtitles,
      playerConfig,
    };

    return NextResponse.json({
      ok: true,
      project,
      stats: {
        originalDuration: probe.durationSec,
        trimmedDuration: analysis.durationSec,
        resolution: `${probe.width}x${probe.height}`,
        subtitlesCount: subtitles.length,
        wordsCount: words.length,
        musicUsed: musicPath || "ninguna (agrega mp3 a /public/assets/music/)",
      },
    });
  } catch (err: any) {
    console.error("[/api/clip-emotivo] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido en clip emotivo." },
      { status: 500 }
    );
  }
}
