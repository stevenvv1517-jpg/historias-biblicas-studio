import { task } from "@trigger.dev/sdk/v3";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPopisSubtitles,
  distributeScenesFromPlan,
  buildInputProps,
  secondsToFrames,
  FPS,
  VIDEO_WIDTH,
  VIDEO_HEIGHT,
} from "../src/lib/pipeline";
import type {
  VideoProject,
  RemotionPlayerConfig,
  RenderConfig as RConfig,
  VisualScene,
  AudioFX,
  DialogueBlock,
  VideoCategory,
} from "../src/lib/types";
import { synthesizeEdgeTTS, EDGE_TTS_VOICES } from "../src/lib/clients/edge-tts";
import { transcribeDeepgram } from "../src/lib/clients/deepgram";
import { generateFluxImage } from "../src/lib/clients/cloudflare";
import { planBiblicalVideo, planVersiculo } from "../src/lib/clients/groq";
import { fetchNatureVideo } from "../src/lib/clients/pexels";
import { listMusicFiles } from "../src/lib/video-utils";
import { uploadToB2, getSignedDownloadUrl, writeJsonToB2 } from "../src/lib/b2";

const TRIGGER_TMP = "/tmp";

function toDisk(publicPath: string): string {
  return path.join(TRIGGER_TMP, "assets", publicPath.replace(/^\//, ""));
}

async function getMp3DurationLocal(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return Math.max(1, Number((stat.size / 12000).toFixed(2)));
  } catch {
    return 0;
  }
}

async function concatenateLocal(
  sources: { path: string }[],
  outputPath: string
): Promise<{ path: string; chunks: { path: string; startSec: number; durationSec: number }[] }> {
  const diskOutput = toDisk(outputPath);
  await fs.mkdir(path.dirname(diskOutput), { recursive: true });
  const buffers: Buffer[] = [];
  let cursorSec = 0;
  const chunks: { path: string; startSec: number; durationSec: number }[] = [];
  for (const src of sources) {
    const diskSrc = toDisk(src.path);
    const buf = await fs.readFile(diskSrc);
    const dur = Math.max(1, Number((buf.length / 12000).toFixed(2)));
    buffers.push(buf);
    chunks.push({ path: src.path, startSec: cursorSec, durationSec: dur });
    cursorSec += dur;
  }
  const combined = Buffer.concat(buffers);
  await fs.mkdir(path.dirname(diskOutput), { recursive: true });
  await fs.writeFile(diskOutput, combined);
  return { path: outputPath, chunks };
}

const VOICE_MAP: Record<"hombre" | "mujer", string> = {
  hombre: EDGE_TTS_VOICES.hombre,
  mujer: EDGE_TTS_VOICES.mujer,
};

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

async function uploadAssetsAndReplace(
  videoId: string,
  project: VideoProject,
  localPaths: string[]
): Promise<VideoProject> {
  const urlMap = new Map<string, string>();

  for (const localPath of localPaths) {
    const diskPath = toDisk(localPath);
    const ext = path.extname(localPath).toLowerCase();
    const remoteKey = `media/${videoId}${localPath}`;
    try {
      await uploadToB2(diskPath, remoteKey);
      const url = await getSignedDownloadUrl(remoteKey, 604800);
      urlMap.set(localPath, url);
    } catch (err: any) {
      console.error(`[pipeline-task] Error uploading ${localPath}:`, err.message);
    }
  }

  const replace = (p: string) => urlMap.get(p) || p;

  project.audioConfig.localPath = replace(project.audioConfig.localPath);

  for (const scene of project.visualScenes) {
    scene.localPath = replace(scene.localPath);
  }

  const inputProps = project.remotionPlayerConfig.inputProps as any;
  inputProps.audioPath = replace(inputProps.audioPath);
  if (inputProps.musicPath) inputProps.musicPath = replace(inputProps.musicPath);
  if (inputProps.scenes) {
    for (const s of inputProps.scenes) {
      s.localPath = replace(s.localPath);
    }
  }
  if (inputProps.audioClips) {
    for (const c of inputProps.audioClips) {
      c.path = replace(c.path);
    }
  }

  return project;
}

export const runPipelineTask = task({
  id: "run-pipeline",
  queue: { concurrencyLimit: 3 },
  maxDuration: 600,
  run: async (payload: {
    videoId: string;
    topic: string;
    category: VideoCategory;
    speed: number;
    channelName?: string;
    userEmail?: string;
  }) => {
    const { videoId, topic, category, speed, channelName: bodyChannelName, userEmail } = payload;
    const createdAt = new Date().toISOString();
    const isMoraleja = category === "moraleja";
    const isVersiculo = category === "versiculo";

    await writeJsonToB2(`pipeline/${videoId}/status.json`, {
      videoId,
      status: "processing",
      createdAt,
    }).catch(() => {});

    try {
      const plan = isVersiculo
        ? await planVersiculo({ topic })
        : await planBiblicalVideo({ topic, category });

      let audioPublicPath = `/assets/audio/${videoId}.mp3`;
      let audioDurationSec = 0;
      let audioClips: { path: string; startSec: number; durationSec: number }[] = [];
      let dialogues: DialogueBlock[][] = [];
      let verseText = "";
      let verseReference = "";
      let reflection = "";
      let natureVideoUrl = "";

      if (isVersiculo) {
        verseText = (plan as any).verseReference ? (plan as any).verseText || "" : "";
        verseReference = (plan as any).verseReference || "";
        reflection = (plan as any).scenes?.[0]?.reflection || (plan as any).fullNarration || "";

        await synthesizeEdgeTTS({
          text: plan.fullNarration,
          voice: "narrador",
          outputPath: toDisk(audioPublicPath),
        });
        audioDurationSec = await getMp3DurationLocal(toDisk(audioPublicPath));

        const pexelVideo = await fetchNatureVideo();
        natureVideoUrl = pexelVideo.url;
      } else if (isMoraleja) {
        const sceneAudioPaths: string[] = [];

        for (let i = 0; i < plan.scenes.length; i++) {
          const scenePlan = plan.scenes[i];
          const sceneDialogueBlocks: DialogueBlock[] = [];
          const scenePaths: string[] = [];
          let sceneCursor = 0;

          if (scenePlan.dialogues && scenePlan.dialogues.length > 0) {
            for (const d of scenePlan.dialogues) {
              const voice = VOICE_MAP[d.gender] || EDGE_TTS_VOICES.hombre;
              const dialoguePath = `/assets/audio/${videoId}_scene${i}_${d.character.toLowerCase().replace(/\s+/g, "_")}.mp3`;

              const result = await synthesizeEdgeTTS({
                text: d.line,
                voice,
                outputPath: toDisk(dialoguePath),
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
            const fallbackPath = `/assets/audio/${videoId}_scene${i}_narration.mp3`;
            await synthesizeEdgeTTS({
              text: scenePlan.narration,
              voice: EDGE_TTS_VOICES.hombre,
              outputPath: toDisk(fallbackPath),
            });
            scenePaths.push(fallbackPath);
          }

          const sceneAudioPath = `/assets/audio/${videoId}_scene${i}_combined.mp3`;
          const concatResult = await concatenateLocal(
            scenePaths.map((p) => ({ path: p })),
            sceneAudioPath
          );
          sceneAudioPaths.push(sceneAudioPath);

          for (const chunk of concatResult.chunks) {
            audioClips.push({
              path: chunk.path,
              startSec: chunk.startSec,
              durationSec: chunk.durationSec,
            });
          }

          dialogues.push(sceneDialogueBlocks);
        }

        const finalAudioPath = `/assets/audio/${videoId}_final.mp3`;
        const finalConcat = await concatenateLocal(
          sceneAudioPaths.map((p) => ({ path: p })),
          finalAudioPath
        );
        audioPublicPath = finalAudioPath;
        audioDurationSec = finalConcat.chunks.reduce((sum, c) => sum + c.durationSec, 0);

        let globalCursor = 0;
        audioClips = [];
        for (const scenePath of sceneAudioPaths) {
          const dur = await getMp3DurationLocal(toDisk(scenePath));
          audioClips.push({ path: scenePath, startSec: globalCursor, durationSec: dur });
          globalCursor += dur;
        }
      } else {
        await synthesizeEdgeTTS({
          text: plan.fullNarration,
          voice: "narrador",
          outputPath: toDisk(audioPublicPath),
        });
        audioDurationSec = await getMp3DurationLocal(toDisk(audioPublicPath));
      }

      const { words, durationSec: deepgramDuration } = await transcribeDeepgram({
        audioPath: toDisk(audioPublicPath),
        language: "es",
        model: "nova-2",
      });
      const popisSubtitles = buildPopisSubtitles(words);
      audioDurationSec = deepgramDuration || audioDurationSec;

      const musicFiles = await listMusicFiles().catch(() => []);
      const musicPath = musicFiles.length > 0
        ? musicFiles[Math.floor(Math.random() * musicFiles.length)]
        : undefined;

      const channelName = bodyChannelName?.trim() || "";
      let project: VideoProject;
      let stats: Record<string, any>;

      if (isVersiculo) {
        const versiculoInputProps = {
          verseText,
          verseReference,
          reflection,
          audioPath: audioPublicPath,
          videoUrl: natureVideoUrl,
          musicPath,
          totalDurationSec: audioDurationSec,
          channelName,
          subtitles: popisSubtitles,
        };

        const remotionPlayerConfig: RemotionPlayerConfig = {
          compositionName: "VersiculoVideo",
          durationInFrames: secondsToFrames(audioDurationSec),
          fps: FPS,
          width: VIDEO_WIDTH,
          height: VIDEO_HEIGHT,
          inputProps: versiculoInputProps as any,
        };

        const renderConfig: RConfig = {
          codec: "h264",
          outputLocation: `/assets/videos/${videoId}.mp4`,
          imageFormat: "jpeg",
          crf: 18,
          audioCodec: "aac",
        };

        project = {
          id: videoId,
          createdAt,
          category,
          theme: category,
          audioConfig: {
            script: plan.fullNarration,
            voice: "edge-tts",
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
          visualScenes: [],
          remotionPlayerConfig,
          renderConfig,
        };

        stats = {
          topic,
          title: plan.title,
          category,
          durationSec: audioDurationSec,
          scenes: 0,
          subtitles: popisSubtitles.length,
          words: words.length,
          imagesGenerated: 0,
          verseReference,
        };
      } else {
        const scenes: VisualScene[] = distributeScenesFromPlan(
          audioDurationSec,
          plan.scenes,
          isMoraleja ? "moraleja" : "biblica"
        ).map((s, i) => {
          const planScene = plan.scenes[i];
          const animations: VisualScene["animationSettings"]["motion"][] = [
            "ken-burns-in", "pan-right", "ken-burns-out", "pan-left", "static",
          ];

          const groqAnim = planScene.animation?.toLowerCase() || "";
          let motion: VisualScene["animationSettings"]["motion"] = animations[i % animations.length];
          if (groqAnim.includes("zoom") || groqAnim.includes("close")) motion = "ken-burns-in";
          else if (groqAnim.includes("pan")) motion = groqAnim.includes("left") ? "pan-left" : "pan-right";
          else if (groqAnim.includes("breath") || groqAnim.includes("blink") || groqAnim.includes("head")) motion = "static";

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
            animationSettings: { motion, intensity: 0.35 },
            audioFx,
            dialogues: isMoraleja ? (dialogues[i] || []) : undefined,
          };
        });

        await Promise.all(
          scenes.map((scene) =>
            generateFluxImage({
              prompt: scene.promptFlux,
              outputPath: toDisk(scene.localPath),
            })
          )
        );

        const inputProps = buildInputProps(
          scenes,
          popisSubtitles,
          audioPublicPath,
          audioDurationSec,
          { title: plan.title, theme: category, category },
          isMoraleja ? audioClips : undefined,
          musicPath,
          channelName
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
          outputLocation: `/assets/videos/${videoId}.mp4`,
          imageFormat: "jpeg",
          crf: 18,
          audioCodec: "aac",
        };

        project = {
          id: videoId,
          createdAt,
          category,
          theme: category,
          audioConfig: {
            script: plan.fullNarration,
            voice: "edge-tts",
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

        stats = {
          topic,
          title: plan.title,
          category,
          durationSec: audioDurationSec,
          scenes: scenes.length,
          subtitles: popisSubtitles.length,
          words: words.length,
          imagesGenerated: scenes.length,
          dialoguesTotal: isMoraleja ? dialogues.flat().length : 0,
          audioClips: audioClips.length,
        };
      }

      const localPathsToUpload: string[] = [audioPublicPath];
      for (const scene of project.visualScenes) {
        localPathsToUpload.push(scene.localPath);
      }
      if (isMoraleja) {
        for (const clip of audioClips) {
          if (!localPathsToUpload.includes(clip.path)) localPathsToUpload.push(clip.path);
        }
      }

      project = await uploadAssetsAndReplace(videoId, project, localPathsToUpload);

      await writeJsonToB2(`pipeline/${videoId}/project.json`, { project, stats });

      const historyEntry = {
        id: videoId,
        title: plan.title,
        category,
        createdAt,
        durationSec: audioDurationSec,
        scenes: project.visualScenes?.length ?? 0,
        subtitles: popisSubtitles.length,
        remoteKey: `pipeline/${videoId}/project.json`,
        b2Url: "",
        localPath: audioPublicPath,
      };

      const historyKey = userEmail
        ? `meta/history_${Buffer.from(userEmail).toString("base64url").slice(0, 48)}.json`
        : "meta/history_anonymous.json";

      try {
        const { readJsonFromB2 } = await import("../src/lib/b2");
        const existing = await readJsonFromB2<any[]>(historyKey);
        const history = existing || [];
        history.unshift(historyEntry);
        await writeJsonToB2(historyKey, history);
      } catch {
        await writeJsonToB2(historyKey, [historyEntry]);
      }

      await writeJsonToB2(`pipeline/${videoId}/status.json`, {
        videoId,
        status: "done",
        createdAt,
        stats,
      });

      return { videoId, status: "done" as const };
    } catch (err: any) {
      console.error("[pipeline-task] error:", err);

      await writeJsonToB2(`pipeline/${videoId}/status.json`, {
        videoId,
        status: "failed",
        createdAt,
        error: err?.message ?? "Error desconocido",
      }).catch(() => {});

      throw err;
    }
  },
});
