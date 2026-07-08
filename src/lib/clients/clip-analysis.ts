import type { EmotionalAnalysis } from "../types";

// ============================================================
//  Cliente Groq — Análisis emocional de clips.
//
//  Como Groq no procesa video directamente, usamos el tema/contexto
//  del clip para que el LLM infiera qué tipo de momento es el más
//  emotivo y sugiera un segmento (startTime, endTime).
//
//  Futuro: reemplazar con un modelo de visión (Cloudflare Workers AI
//  o Llama 3.2 Vision vía Groq) para análisis real del contenido.
// ============================================================

export interface AnalyzeEmotionParams {
  /** Descripción o tema del clip (ej: "predicación sobre la fe"). */
  topic: string;
  /** Duración total del video en segundos. */
  totalDurationSec: number;
  /** Duración máxima del clip final (default 60). */
  maxClipDuration?: number;
}

/**
 * Pide a Groq que identifique el segmento más emotivo de un video.
 * Devuelve JSON con startTime, endTime, título, color grading, etc.
 */
export async function analyzeClipEmotion({
  topic,
  totalDurationSec,
  maxClipDuration = 60,
}: AnalyzeEmotionParams): Promise<EmotionalAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Falta GROQ_API_KEY en el entorno.");
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  const systemPrompt = `Eres un editor de video experto en contenido cristiano/emotivo.
Tu tarea es analizar la descripción de un video y determinar cuál sería el segmento
de MAYOR carga emocional, ideal para compartir como clip corto (reel/TikTok).

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con JSON válido, sin texto antes ni después.
- El video dura ${totalDurationSec} segundos.
- El clip resultante debe durar MÁXIMO ${maxClipDuration} segundos.
- startTime debe estar entre 0 y ${totalDurationSec - 10}.
- endTime = startTime + duración (no puede superar ${totalDurationSec}).
- Genera un título de impacto corto y llamativo relacionado con el tema.
- Sugiere ajustes de color grading cinematográfico emocional.

FORMATO DE SALIDA:
{
  "title": "string (título de impacto)",
  "startTime": number (en segundos),
  "endTime": number (en segundos),
  "durationSec": number,
  "summary": "string (resumen del momento emocional)",
  "colorGrading": {
    "brightness": number (-1 a 1),
    "contrast": number (0 a 2),
    "saturation": number (0 a 3),
    "warmth": number (0 a 2)
  }
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Video de ${totalDurationSec}s. Tema: "${topic}". Identifica el segmento más emotivo.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq análisis ${res.status}: ${errText}`);
  }

  const json: any = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Groq: respuesta vacía en análisis emocional.");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq: respuesta no es JSON válido.");
  }

  // Validación y clamping de valores.
  let startTime = Number(parsed?.startTime ?? 0);
  let endTime = Number(parsed?.endTime ?? Math.min(maxClipDuration, totalDurationSec));
  let durationSec = Number(parsed?.durationSec ?? endTime - startTime);

  // Asegurar que el segmento está dentro del video.
  startTime = Math.max(0, Math.min(startTime, totalDurationSec - 5));
  durationSec = Math.min(durationSec, maxClipDuration, totalDurationSec - startTime);
  durationSec = Math.max(5, durationSec); // mínimo 5 segundos
  endTime = startTime + durationSec;

  return {
    title: String(parsed?.title ?? topic).trim(),
    startTime: Math.round(startTime * 100) / 100,
    endTime: Math.round(endTime * 100) / 100,
    durationSec: Math.round(durationSec * 100) / 100,
    summary: String(parsed?.summary ?? "").trim(),
    colorGrading: {
      brightness: Number(parsed?.colorGrading?.brightness ?? 0.05),
      contrast: Number(parsed?.colorGrading?.contrast ?? 1.1),
      saturation: Number(parsed?.colorGrading?.saturation ?? 1.2),
      warmth: Number(parsed?.colorGrading?.warmth ?? 1.15),
    },
  };
}
