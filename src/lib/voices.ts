import type { VoiceOption } from "./types";

// ============================================================
//  Voces edge-tts (Microsoft Edge TTS) para narración bíblica en español.
//  Gratis, sin API key, incluye subtítulos SRT.
// ============================================================

export const EDGE_TTS_VOICES_CATALOG: VoiceOption[] = [
  {
    id: "narrador",
    label: "Elvira — Narradora principal",
    description: "Voz femenina clara y natural (España), ideal para narración bíblica.",
  },
  {
    id: "hombre",
    label: "Álvaro — Personajes masculinos",
    description: "Voz masculina autoritaria (España), perfecta para profetas y reyes.",
  },
  {
    id: "mujer",
    label: "Dalia — Personajes femeninos",
    description: "Voz femenina cálida (México), ideal para historias de fe.",
  },
];

/** Catálogo de SFX genéricos (rutas locales en /public/assets/sfx). */
export const SFX_CATALOG = {
  thunder: "/assets/sfx/thunder.mp3",
  wind: "/assets/sfx/wind.mp3",
  crowd: "/assets/sfx/crowd.mp3",
  water: "/assets/sfx/water.mp3",
  choir: "/assets/sfx/choir.mp3",
  bell: "/assets/sfx/bell.mp3",
} as const;

export type SfxKey = keyof typeof SFX_CATALOG;
