// @ts-ignore — edge-tts npm package main points to raw .ts, we import compiled JS
import { tts, type options } from "edge-tts/out/index.js";
import fs from "node:fs/promises";
import path from "node:path";

// Voces de español para edge-tts
export const EDGE_TTS_VOICES = {
  // Narrador principal - español España, femenina, clara y natural
  narrador: "es-ES-ElviraNeural",
  // Personajes masculinos - español España, masculina, autoritaria
  hombre: "es-ES-AlvaroNeural",
  // Personajes femeninos - español México, femenina, cálida
  mujer: "es-MX-DaliaNeural",
} as const;

export type EdgeTTSVoice = keyof typeof EDGE_TTS_VOICES;

// Límite de caracteres por llamada (edge-tts no tiene límite oficial, pero usamos uno razonable)
const MAX_CHARS = 4000;

function splitIntoChunks(text: string, maxLen: number): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if ((current + " " + part).trim().length <= maxLen) {
      current = (current + " " + part).trim();
    } else {
      if (current) chunks.push(current);
      current = part;
      while (current.length > maxLen) {
        chunks.push(current.slice(0, maxLen));
        current = current.slice(maxLen);
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function estimateDuration(text: string, bytes: number): number {
  const fromText = Math.max(1, text.length / 15);
  const fromBytes = Math.max(1, bytes / 16000);
  return Number(((fromText + fromBytes) / 2).toFixed(2));
}

/**
 * Sintetiza texto usando edge-tts (Microsoft Edge TTS).
 * Genera MP3.
 */
async function synthesizeChunk(
  text: string,
  voice: string,
  outputPath: string
): Promise<{ audioPath: string; durationSec: number; bytes: number }> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  try {
    // Usar edge-tts npm package para generar audio
    const opts: options = {
      voice,
      rate: "+0%",
      pitch: "+0Hz",
    };

    const audioBuffer = await tts(text, opts);
    await fs.writeFile(outputPath, audioBuffer);

    const bytes = audioBuffer.length;
    const durationSec = estimateDuration(text, bytes);

    return { audioPath: outputPath, durationSec, bytes };
  } catch (error: any) {
    console.error(`[EdgeTTS] Error sintetizando chunk:`, error.message);
    throw error;
  }
}

/**
 * Sintetiza texto largo usando edge-tts, dividiendo en chunks si es necesario.
 * Genera MP3.
 */
export async function synthesizeEdgeTTS({
  text,
  voice = "narrador",
  outputPath,
}: {
  text: string;
  voice?: EdgeTTSVoice | string;
  outputPath: string;
}): Promise<{ path: string; durationSec: number; bytes: number }> {
  const voiceName = EDGE_TTS_VOICES[voice as EdgeTTSVoice] || voice;

  if (text.length <= MAX_CHARS) {
    const result = await synthesizeChunk(text, voiceName, outputPath);
    return {
      path: result.audioPath,
      durationSec: result.durationSec,
      bytes: result.bytes,
    };
  }

  // Dividir en chunks si el texto es largo
  const chunks = splitIntoChunks(text, MAX_CHARS);
  const audioBuffers: Buffer[] = [];
  let totalBytes = 0;
  let totalDuration = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = outputPath.replace(/\.mp3$/, `_chunk${i}.mp3`);
    const result = await synthesizeChunk(chunks[i], voiceName, chunkPath);

    const audioBuf = await fs.readFile(result.audioPath);
    audioBuffers.push(audioBuf);
    totalBytes += result.bytes;
    totalDuration += result.durationSec;

    // Limpiar chunk temporal
    await fs.unlink(result.audioPath).catch(() => {});
  }

  // Concatenar audio
  const combined = Buffer.concat(audioBuffers);
  await fs.writeFile(outputPath, combined);

  return {
    path: outputPath,
    durationSec: totalDuration,
    bytes: totalBytes,
  };
}
