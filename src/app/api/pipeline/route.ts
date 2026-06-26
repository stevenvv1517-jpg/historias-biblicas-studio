import { NextResponse } from "next/server";
import {
  buildPopisSubtitles,
  distributeScenesFromPlan,
  buildInputProps,
  generateProjectId,
  secondsToFrames,
  FPS,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
  FLUX_PROMPT_TEMPLATE,
  FLUX_PROMPT_MORALEJA_TEMPLATE,
} from "@/lib/pipeline";
import type {
  VideoProject,
  RemotionPlayerConfig,
  RenderConfig as RConfig,
  VisualScene,
  AudioFX,
  DialogueBlock,
  VideoCategory,
} from "@/lib/types";
import { synthesizeLmnt } from "@/lib/clients/lmnt";
import { transcribeDeepgram } from "@/lib/clients/deepgram";
import { generateFluxImage } from "@/lib/clients/cloudflare";
import { planBiblicalVideo } from "@/lib/clients/groq";
import { publicToDisk } from "@/lib/paths";
import { concatenateMp3s, getMp3Duration } from "@/lib/audio";

// Forzamos runtime Node para poder usar fs y fetch nativo.
export const runtime = "nodejs";
export const maxDuration = 300; // 5 min: las llamadas a IA tardan.

// Mapa de voces LMNT por género
const VOICE_MAP: Record<"hombre" | "mujer", string> = {
  hombre: "marcus",
  mujer: "lily",
};

// Catálogo de SFX (mapeo label -> ruta)
const SFX_LABEL_MAP: Record<string, string> = {
  trueno: "/assets/sfx/thunder.mp3",
  viento: "/assets/sfx/wind.mp3",
  multitud: "/assets/sfx/crowd.mp3",
  agua: "/assets/sfx/water.mp3",
  coro: "/assets/sfx/choir.mp3",
  campana: "/assets/sfx/bell.mp3",
  lluvia: "/assets/sfx/thunder.mp3",
  tormenta: "/assets/sfx/thunder.mp3",
  susurro: "/assets/sfx/wind.mp3",
  pasos: "/assets/sfx/crowd.mp3",
  murmullo: "/assets/sfx/crowd.mp3",
  risa: "/assets/sfx/crowd.mp3",
  llanto: "/assets/sfx/water.mp3",
  silencio: "",
};

function resolveSfxPath(label: string): string {
  const key = label.toLowerCase().trim();
  return SFX_LABEL_MAP[key] || "";
}

// ============================================================
//  POST /api/pipeline
//  Orquesta el flujo completo según categoría:
//   0. Groq    -> título + guion + escenas visuales (+ diálogos si MORALEJA)
//   1. LMNT    -> audio mp3 (único o múltiple por diálogo) + duración
//   2. Deepgram -> palabras temporizadas -> subtítulos Popis
//   3. Cloudflare Flux -> una imagen por escena
//   4. Animate Flux     -> animación sutil de cada imagen
//   5. FX_SYNC          -> efectos de sonido sincronizados
//   6. Ensambla el VideoProject con remotion_player_config
//
//  Body: { topic, category?, voice?, sceneCount?, speed? }
// ============================================================

interface PipelineBody {
  topic: string;
  category?: VideoCategory;
  voice?: string;
  sceneCount?: number;
  speed?: number;
}

export async function POST(req: Request) {
  let body: PipelineBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { topic, category = "biblica", voice, sceneCount = 6, speed = 1 } = body;

  if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
    return NextResponse.json(
      { error: "El tema debe tener al menos 3 caracteres." },
      { status: 400 }
    );
  }

  const isMoraleja = category === "moraleja";
  const projectId = generateProjectId();
  const createdAt = new Date().toISOString();

  try {
    // ==================================================================
    //  0) PLAN (Groq)
    // ==================================================================
    const plan = await planBiblicalVideo({ topic, sceneCount, category });
    const totalDurationSec = 0; // se calcula tras audio

    // ==================================================================
    //  1) AUDIO (LMNT) + concatenación
    // ==================================================================
    let audioPublicPath = `/assets/audio/${projectId}.mp3`;
    let audioDurationSec = 0;
    let audioClips: { path: string; startSec: number; durationSec: number }[] = [];
    let dialogues: DialogueBlock[][] = [];

    if (isMoraleja) {
      // --- MORALEJA: sintetizar cada diálogo por separado ---
      const sceneAudioPaths: string[] = [];

      for (let i = 0; i < plan.scenes.length; i++) {
        const scenePlan = plan.scenes[i];
        const sceneDialogueBlocks: DialogueBlock[] = [];
        const scenePaths: string[] = [];
        let sceneCursor = 0;

        if (scenePlan.dialogues && scenePlan.dialogues.length > 0) {
          for (const d of scenePlan.dialogues) {
            const voiceId = process.env.LMNT_VOICE_ID?.trim() || VOICE_MAP[d.gender] || "marcus";
            const dialoguePath = `/assets/audio/${projectId}_scene${i}_${d.character.toLowerCase().replace(/\s+/g, "_")}.mp3`;

            const result = await synthesizeLmnt({
              text: d.line,
              voice: voiceId,
              format: "mp3",
              speed,
              outputPath: publicToDisk(dialoguePath),
            });

            const block: DialogueBlock = {
              character: d.character,
              gender: d.gender,
              line: d.line,
              localPath: dialoguePath,
              durationSec: result.durationSec,
              startOffsetSec: sceneCursor,
              endOffsetSec: sceneCursor + result.durationSec,
            };
            sceneDialogueBlocks.push(block);
            scenePaths.push(dialoguePath);
            sceneCursor += result.durationSec;
          }
        } else {
          // Fallback: narración simple si Groq no generó diálogos
          const fallbackPath = `/assets/audio/${projectId}_scene${i}_narration.mp3`;
          const result = await synthesizeLmnt({
            text: scenePlan.narration,
            voice: process.env.LMNT_VOICE_ID?.trim() || voice || "marcus",
            format: "mp3",
            speed,
            outputPath: publicToDisk(fallbackPath),
          });
          scenePaths.push(fallbackPath);
        }

        // Concatenar audio de la escena
        const sceneAudioPath = `/assets/audio/${projectId}_scene${i}_combined.mp3`;
        const concatResult = await concatenateMp3s(
          scenePaths.map((p) => ({ path: p })),
          sceneAudioPath
        );
        sceneAudioPaths.push(sceneAudioPath);

        // Acumular clips para Remotion
        for (const chunk of concatResult.chunks) {
          audioClips.push({
            path: chunk.path,
            startSec: chunk.startSec,
            durationSec: chunk.durationSec,
          });
        }

        dialogues.push(sceneDialogueBlocks);
      }

      // Concatenar todas las escenas en un audio final
      const finalAudioPath = `/assets/audio/${projectId}_final.mp3`;
      const finalConcat = await concatenateMp3s(
        sceneAudioPaths.map((p) => ({ path: p })),
        finalAudioPath
      );
      audioPublicPath = finalAudioPath;
      audioDurationSec = finalConcat.chunks.reduce((sum, c) => sum + c.durationSec, 0);

      // Recalcular offsets globales
      let globalCursor = 0;
      audioClips = [];
      for (const scenePath of sceneAudioPaths) {
        const dur = await getMp3Duration(publicToDisk(scenePath));
        audioClips.push({ path: scenePath, startSec: globalCursor, durationSec: dur });
        globalCursor += dur;
      }
    } else {
      // --- BÍBLICA: sintetizar narración completa ---
      const resolvedVoice = process.env.LMNT_VOICE_ID?.trim() || voice || "marcus";
      await synthesizeLmnt({
        text: plan.fullNarration,
        voice: resolvedVoice,
        format: "mp3",
        speed,
        outputPath: publicToDisk(audioPublicPath),
      });
      audioDurationSec = await getMp3Duration(publicToDisk(audioPublicPath));
    }

    // ==================================================================
    //  2) SUBTÍTULOS (Deepgram)
    // ==================================================================
    const { words, durationSec: deepgramDuration } = await transcribeDeepgram({
      audioPath: publicToDisk(audioPublicPath),
      language: "es",
      model: "nova-2",
    });
    const popisSubtitles = buildPopisSubtitles(words);
    audioDurationSec = deepgramDuration || audioDurationSec;

    // ==================================================================
    //  3) IMÁGENES (Flux) + ANIMATION + FX
    // ==================================================================
    // Construir escenas visuales con datos enriquecidos de Groq
    const scenes: VisualScene[] = distributeScenesFromPlan(
      audioDurationSec,
      plan.scenes
    ).map((s, i) => {
      const planScene = plan.scenes[i];
      const animations: VisualScene["animationSettings"]["motion"][] = [
        "ken-burns-in", "pan-right", "ken-burns-out", "pan-left", "static",
      ];

      // Usar animation de Groq si existe
      const groqAnim = planScene.animation?.toLowerCase() || "";
      let motion: VisualScene["animationSettings"]["motion"] = animations[i % animations.length];
      if (groqAnim.includes("zoom") || groqAnim.includes("close")) motion = "ken-burns-in";
      else if (groqAnim.includes("pan")) motion = groqAnim.includes("left") ? "pan-left" : "pan-right";
      else if (groqAnim.includes("breath") || groqAnim.includes("blink") || groqAnim.includes("head")) motion = "static";

      // FX sincronizados
      const audioFx: AudioFX[] = (planScene.sfx || []).map((sfxItem, fi) => ({
        id: `fx_${i}_${fi}`,
        at: Number(sfxItem.at) || 0,
        path: resolveSfxPath(sfxItem.label),
        volume: 0.5,
        label: sfxItem.label,
      })).filter((fx) => fx.path.length > 0);

      return {
        ...s,
        promptAnimation: planScene.animation || "slow zoom",
        animationSettings: {
          motion,
          intensity: 0.35,
        },
        audioFx,
        dialogues: isMoraleja ? (dialogues[i] || []) : undefined,
      };
    });

    // Generar imágenes Flux para cada escena
    const fluxResults = await Promise.all(
      scenes.map((scene) =>
        generateFluxImage({
          prompt: scene.promptFlux,
          outputPath: publicToDisk(scene.localPath),
        })
      )
    );

    // ==================================================================
    //  4) ENSAMBLAR RemotionPlayerConfig
    // ==================================================================
    const inputProps = buildInputProps(
      scenes,
      popisSubtitles,
      audioPublicPath,
      audioDurationSec,
      { title: plan.title, theme: category },
      isMoraleja ? audioClips : undefined
    );

    const remotionPlayerConfig: RemotionPlayerConfig = {
      compositionName: "MainVideo",
      durationInFrames: secondsToFrames(audioDurationSec),
      fps: FPS,
      width: VIDEO_WIDTH,
      height: VIDEO_HEIGHT,
      inputProps,
    };

    const renderConfig: RConfig = {
      codec: "h264",
      outputLocation: `/assets/videos/${projectId}.mp4`,
      imageFormat: "jpeg",
      crf: 18,
      audioCodec: "aac",
    };

    const project: VideoProject = {
      id: projectId,
      createdAt,
      category,
      theme: category,
      audioConfig: {
        script: plan.fullNarration,
        voice: process.env.LMNT_VOICE_ID?.trim() || voice || "marcus",
        format: "mp3",
        speed,
        localPath: audioPublicPath,
        durationSec: audioDurationSec,
      },
      subtitlesConfig: {
        audioPath: audioPublicPath,
        model: "nova-2",
        language: "es",
        smart_format: true,
        type: "popis",
      },
      visualScenes: scenes,
      remotionPlayerConfig,
      renderConfig,
    };

    return NextResponse.json({
      ok: true,
      project,
      stats: {
        topic,
        title: plan.title,
        category,
        durationSec: audioDurationSec,
        scenes: scenes.length,
        subtitles: popisSubtitles.length,
        words: words.length,
        imagesGenerated: fluxResults.length,
        dialoguesTotal: isMoraleja ? dialogues.flat().length : 0,
        audioClips: audioClips.length,
      },
    });
  } catch (err: any) {
    console.error("[/api/pipeline] error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Error desconocido en el pipeline." },
      { status: 500 }
    );
  }
}
