import fs from "node:fs/promises";
import type { TimedWord } from "../types";

// ============================================================
//  Cliente Deepgram — Transcripción con word-level timestamps
//  Endpoint: POST https://api.deepgram.com/v1/listen
//  Devuelve palabras con start/end (segundos) para subtítulos Popis.
// ============================================================

export interface DeepgramTranscribeParams {
  audioPath: string; // ruta absoluta del mp3/wav
  language?: string; // "es"
  model?: string; // "nova-2"
}

export interface DeepgramTranscribeResult {
  words: TimedWord[];
  durationSec: number;
}

export async function transcribeDeepgram({
  audioPath,
  language = "es",
  model = "nova-2",
}: DeepgramTranscribeParams): Promise<DeepgramTranscribeResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) throw new Error("Falta DEEPGRAM_API_KEY en el entorno.");

  const audioBuf = await fs.readFile(audioPath);
  const ext = audioPath.toLowerCase().endsWith(".wav") ? "wav" : "mp3";
  const contentType =
    ext === "wav" ? "audio/wav" : "audio/mpeg";

  const url =
    `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}` +
    `&language=${encodeURIComponent(language)}` +
    `&smart_format=true&punctuate=true&diarize=false` +
    `&utterances=false&summarize=false`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": contentType,
    },
    body: audioBuf,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Deepgram ${res.status}: ${errText}`);
  }

  const json: any = await res.json();
  const channel = json?.results?.channels?.[0];
  const alternatives = channel?.alternatives?.[0];
  const rawWords: any[] = alternatives?.words ?? [];

  const words: TimedWord[] = rawWords.map((w) => ({
    text: String(w.punctuated_word ?? w.word ?? ""),
    start: Number(w.start ?? 0),
    end: Number(w.end ?? w.start ?? 0),
    confidence: Number(w.confidence ?? 0),
  }));

  const durationSec = Number(json?.results?.duration ?? 0) || words.at(-1)?.end || 0;

  return { words, durationSec };
}
