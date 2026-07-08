import type {
  PopisSubtitle,
  TimedWord,
  VideoCategory,
  VisualScene,
  RemotionInputProps,
} from "./types";
import type { GroqScenePlan } from "./clients/groq";

// ============================================================
//  Utilidades de conversión y orquestación del pipeline
// ============================================================

export const FPS = 30;
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;

/** Convierte segundos a frames a 30fps. */
export function secondsToFrames(seconds: number): number {
  return Math.round(seconds * FPS);
}

/** Convierte frames a segundos. */
export function framesToSeconds(frames: number): number {
  return frames / FPS;
}

/**
 * Plantilla obligatoria del prompt de Flux según la especificación (BÍBLICA).
 * Asegura estética cinematográfica y composición vertical 9:16.
 */
export const FLUX_PROMPT_TEMPLATE = (description: string) =>
  `Cinematic, 8k, highly detailed, ${description}, dramatic lighting, hyper-realistic, vertical composition for 9:16 aspect ratio`;

/**
 * Plantilla para categoría MORALEJA (estilo cinematográfico realista, más terrenal).
 */
export const FLUX_PROMPT_MORALEJA_TEMPLATE = (description: string) =>
  `Cinematic, 8k, 35mm photorealistic, ${description}, natural lighting, deep depth of field, authentic, vertical composition for 9:16 aspect ratio`;

/**
 * Convierte la lista cruda de palabras temporizadas (Deepgram) en
 * subtítulos "Popis": agrupa palabras en bloques de hasta 4 palabras
 * o hasta alcanzar un máximo de ~1.8s, lo que ocurra primero.
 */
export function buildPopisSubtitles(words: TimedWord[]): PopisSubtitle[] {
  const subtitles: PopisSubtitle[] = [];
  let current: TimedWord[] = [];
  let id = 0;

  const flush = () => {
    if (current.length === 0) return;
    const start = current[0].start;
    const end = current[current.length - 1].end;
    const text = current.map((w) => w.text).join(" ");
    subtitles.push({ id: id++, words: [...current], start, end, text });
    current = [];
  };

  for (const w of words) {
    current.push(w);
    const start = current[0].start;
    // Cortar si ya hay 4 palabras o si el bloque supera 1.8s
    if (current.length >= 4 || w.end - start >= 1.8) flush();
  }
  flush();
  return subtitles;
}

/**
 * Reparte la duración total entre las escenas de Groq proporcionalmente
 * a la longitud de su narración (asumiendo velocidad de habla uniforme).
 * Así cada imagen coincide con la parte del audio que le corresponde.
 */
export function distributeScenesFromPlan(
  totalDurationSec: number,
  scenesPlan: GroqScenePlan[],
  category: "biblica" | "moraleja" = "biblica"
): VisualScene[] {
  const lengths = scenesPlan.map((s) => Math.max(1, s.narration.length));
  const totalLen = lengths.reduce((a, b) => a + b, 0) || 1;

  const promptFn = category === "moraleja" ? FLUX_PROMPT_MORALEJA_TEMPLATE : FLUX_PROMPT_TEMPLATE;

  let cursorSec = 0;
  return scenesPlan.map((plan, i) => {
    const fraction = lengths[i] / totalLen;
    const duration = Number((totalDurationSec * fraction).toFixed(2));
    const _ = cursorSec;
    cursorSec += duration;

    const motions: VisualScene["animationSettings"]["motion"][] = [
      "ken-burns-in",
      "pan-right",
      "ken-burns-out",
      "pan-left",
      "static",
    ];

    const groqAnim = (plan.animation || "").toLowerCase();
    let motion: VisualScene["animationSettings"]["motion"] = motions[i % motions.length];
    if (groqAnim.includes("zoom") || groqAnim.includes("close")) motion = "ken-burns-in";
    else if (groqAnim.includes("pan")) motion = groqAnim.includes("left") ? "pan-left" : "pan-right";
    else if (groqAnim.includes("breath") || groqAnim.includes("blink") || groqAnim.includes("head")) motion = "static";

    return {
      id: i + 1,
      promptFlux: promptFn(plan.description),
      description: plan.description,
      promptAnimation: plan.animation || "slow zoom",
      animationSettings: {
        motion,
        intensity: 0.35,
      },
      duration,
      localPath: `/assets/images/scene_${i + 1}.png`,
      audioFx: [],
    };
  });
}

/** Construye el objeto de inputProps consolidado para Remotion. */
export function buildInputProps(
  scenes: VisualScene[],
  subtitles: PopisSubtitle[],
  audioPath: string,
  totalDurationSec: number,
  meta?: { title: string; theme: string; category?: VideoCategory },
  audioClips?: RemotionInputProps["audioClips"],
  musicPath?: string,
  channelName?: string
): RemotionInputProps {
  const resolvedMeta: RemotionInputProps["meta"] = meta
    ? { title: meta.title, theme: meta.theme, category: (meta.category ?? "biblica") as VideoCategory, channelName }
    : undefined;

  const props: RemotionInputProps = {
    scenes,
    subtitles,
    audioPath,
    totalDurationSec,
    meta: resolvedMeta,
    musicPath,
  };
  if (audioClips && audioClips.length > 0) {
    props.audioClips = audioClips;
  }
  return props;
}

/** ID corto y único para el proyecto. */
export function generateProjectId(): string {
  return `vid_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}
