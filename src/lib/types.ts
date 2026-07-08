// ============================================================
//  Tipos centrales del pipeline de video
//  Compartidos entre API routes, Remotion y la UI de React
// ============================================================

// --- Categorías de video ---

export type VideoCategory = "biblica" | "moraleja" | "versiculo";

/** Género de voz para la categoría MORALEJA (diálogos). */
export type VoiceGender = "hombre" | "mujer";

/** Una palabra con su timestamp exacto (salida de Deepgram word-level). */
export interface TimedWord {
  text: string;
  start: number; // segundos
  end: number; // segundos
  confidence?: number;
}

/** Un subtítulo Popis es un conjunto de palabras que aparecen juntas en pantalla. */
export interface PopisSubtitle {
  id: number;
  words: TimedWord[];
  start: number; // segundos (del primer word)
  end: number; // segundos (del último word)
  text: string; // texto plano reconstruido
}

/** Configuración para la llamada a LMNT. */
export interface AudioConfig {
  script: string;
  voice: string; // ej: "lily", "daniel", "es-ES_marcus"
  format: "mp3" | "wav";
  speed?: number; // 0.25 (lento) - 2.0 (rápido). Default 1.0
  localPath: string; // /assets/audio/voice.mp3
  durationSec?: number; // se rellena tras sintetizar
}

// --- Bloques de diálogo (categoría MORALEJA) ---

/** Un bloque de audio individual dentro de un diálogo MORALEJA. */
export interface DialogueBlock {
  /** Quién habla (nombre del personaje). */
  character: string;
  /** 'hombre' o 'mujer' — determina qué voz LMNT se usa. */
  gender: VoiceGender;
  /** Texto que dice este personaje. */
  line: string;
  /** Ruta del mp3 generado para esta línea. */
  localPath: string;
  /** Duración en segundos (se rellena tras sintetizar). */
  durationSec?: number;
  /** Timestamp de inicio dentro de la escena (acumulado). */
  startOffsetSec?: number;
  /** Timestamp de fin dentro de la escena (acumulado). */
  endOffsetSec?: number;
}

/** Configuración para la API de Deepgram (subtítulos word-level). */
export interface SubtitlesConfig {
  audioPath: string;
  model: string; // ej: "nova-2"
  language: string; // ej: "es"
  smart_format: boolean;
  type: "popis"; // estilo de renderizado de subtítulos
}

/** Efecto de sonido puntual dentro de una escena. */
export interface AudioFX {
  id: string;
  /** momento exacto en segundos dentro de la escena */
  at: number;
  /** ruta local del SFX: /assets/sfx/rain.mp3 */
  path: string;
  volume?: number; // 0..1
  label: string;
}

/** Una escena visual del video. */
export interface VisualScene {
  id: number;
  /** Prompt enriquecido para Flux (ya con la plantilla cinematográfica). */
  promptFlux: string;
  /** Texto descriptivo limpio, sin la plantilla (para logs / UI). */
  description: string;
  /** Animación tipo Flux 1 (movimiento sutil). */
  promptAnimation: string; // ej: "slow zoom", "blinking", "natural head movement"
  /** Ajustes para Ken Burns / pan en Remotion. */
  animationSettings: {
    motion: "static" | "ken-burns-in" | "ken-burns-out" | "pan-left" | "pan-right";
    intensity: number; // 0..1
  };
  /** Duración exacta de esta escena en segundos. */
  duration: number;
  /** Ruta local donde se guardará la imagen generada. */
  localPath: string;
  /** Efectos de sonido sincronizados. */
  audioFx: AudioFX[];
  /**
   * Solo en categoría MORALEJA: bloques de diálogo que se sintetizan
   * por separado con voces distintas según género.
   */
  dialogues?: DialogueBlock[];
}

/** Props que el <Player/> de Remotion recibe directamente. */
export interface RemotionInputProps {
  scenes: VisualScene[];
  subtitles: PopisSubtitle[];
  /** Ruta del audio único (BÍBLICA) o del audio concatenado (MORALEJA). */
  audioPath: string;
  /**
   * MORALEJA: clips de audio por escena (varias voces).
   * Cada entrada tiene la ruta del mp3 y el offset en segundos.
   * BÍBLICA: vacío/undefined (se usa audioPath solo).
   */
  audioClips?: {
    path: string;
    startSec: number;
    durationSec: number;
  }[];
  /** Ruta de la música de fondo (opcional, volumen ~10%). */
  musicPath?: string;
  totalDurationSec: number;
  /** metadatos para el footer / marca de agua opcional */
  meta?: {
    title: string;
    theme: string;
    category: VideoCategory;
    channelName?: string;
  };
  /** index signature para compatibilidad con Record<string, unknown> de Remotion */
  [key: string]: unknown;
}

/** Configuración del <Player/> de Remotion para preview + render. */
export interface RemotionPlayerConfig {
  compositionName: string; // "MainVideo"
  durationInFrames: number; // totalDurationSec * 30
  fps: number; // 30
  width: number; // 1080
  height: number; // 1920
  inputProps: RemotionInputProps;
}

/** Configuración del render final a MP4. */
export interface RenderConfig {
  codec: "h264";
  outputLocation: string; // /assets/videos/video.mp4
  imageFormat: "jpeg" | "png";
  crf: number; // calidad. 18 = alta, 23 = default
  audioCodec: "aac";
}

/** Estructura completa del proyecto de video tras el pipeline. */
export interface VideoProject {
  id: string;
  createdAt: string;
  category: VideoCategory;
  theme: string;
  audioConfig: AudioConfig;
  subtitlesConfig: SubtitlesConfig;
  visualScenes: VisualScene[];
  remotionPlayerConfig: RemotionPlayerConfig;
  renderConfig: RenderConfig;
}

/** Catálogo de voces LMNT preseleccionadas (con foco en español bíblico). */
export interface VoiceOption {
  id: string;
  label: string;
  description: string;
}

// ============================================================
//  Tipos para CLIP EMOTIVO
// ============================================================

/** Análisis emocional devuelto por Groq / visión. */
export interface EmotionalAnalysis {
  /** Título de impacto generado para el clip. */
  title: string;
  /** Inicio del segmento más emotivo en segundos. */
  startTime: number;
  /** Fin del segmento más emotivo en segundos. */
  endTime: number;
  /** Duración del segmento (siempre ≤ 60s). */
  durationSec: number;
  /** Resumen del momento emocional. */
  summary: string;
  /** Sugerencia de color grading. */
  colorGrading: {
    brightness?: number; // -1..1
    contrast?: number; // 0..2
    saturation?: number; // 0..3
    warmth?: number; // 0..2
  };
}

/** Datos que el Remotion Player necesita para renderizar un clip emotivo. */
export interface ClipEmotivoInputProps {
  /** Ruta del clip recortado: /assets/videos/clip_<id>.mp4 */
  videoPath: string;
  /** Ruta de la música de fondo: /assets/music/track_<n>.mp3 */
  musicPath: string;
  /** Título de impacto. */
  title: string;
  /** Subtítulos Popis del segmento. */
  subtitles: PopisSubtitle[];
  /** Duración total del clip final en segundos. */
  totalDurationSec: number;
  /** Ajustes de color grading aplicados vía CSS filters. */
  colorGrading: EmotionalAnalysis["colorGrading"];
  /** metadatos */
  meta?: {
    category: "clip-emotivo";
    originalFilename: string;
  };
  /** index signature para Remotion */
  [key: string]: unknown;
}

/** Configuración del Player para clips emotivos. */
export interface ClipEmotivoPlayerConfig {
  compositionName: "ClipVideo";
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  inputProps: ClipEmotivoInputProps;
}

/** Proyecto completo de clip emotivo. */
export interface ClipEmotivoProject {
  id: string;
  createdAt: string;
  analysis: EmotionalAnalysis;
  /** Ruta del video original subido. */
  originalPath: string;
  /** Ruta del clip recortado con música. */
  finalClipPath: string;
  /** Ruta del clip solo (sin música, para subtítulos). */
  trimmedClipPath: string;
  musicPath: string;
  subtitles: PopisSubtitle[];
  playerConfig: ClipEmotivoPlayerConfig;
}
