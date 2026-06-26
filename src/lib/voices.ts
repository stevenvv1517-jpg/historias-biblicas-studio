import type { VoiceOption } from "./types";

// ============================================================
//  Voces LMNT recomendadas para narración bíblica en español.
//  Verifica disponibilidad en https://app.lmnt.com/api/docs#voices
//  Los IDs son los nombres oficiales de voz de LMNT.
// ============================================================

export const LMNT_VOICES: VoiceOption[] = [
  {
    id: "marcus",
    label: "Marcus — Narrador grave",
    description: "Voz masculina profunda, ideal para relatos épicos y profecías.",
  },
  {
    id: "lily",
    label: "Lily — Narradora cálida",
    description: "Voz femenina suave, perfecta para enseñanzas y Salmos.",
  },
  {
    id: "henry",
    label: "Henry — Voz cinematográfica",
    description: "Voz masculina neutra con tono documental.",
  },
  {
    id: "charlotte",
    label: "Charlotte — Narradora épica",
    description: "Voz femenina potente, ideal para milagros y batallas.",
  },
  {
    id: "daniel",
    label: "Daniel — Voz serena",
    description: "Voz masculina pausada, ideal para enseñanzas de Jesús.",
  },
  {
    id: "eva",
    label: "Eva — Voz dulce",
    description: "Voz femenina cercana para historias de fe.",
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
