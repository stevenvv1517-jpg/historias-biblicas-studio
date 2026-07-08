import React from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender } from "remotion";
import type { RemotionInputProps } from "../src/lib/types";
import { SceneImage } from "./SceneImage";
import { PopisSubtitle } from "./PopisSubtitle";
import { FPS } from "../src/lib/pipeline";

// ============================================================
//  MainVideo — composición principal de 1080x1920 @ 30fps.
//
//  Recibe por inputProps: scenes, subtitles, audioPath, totalDurationSec, audioClips.
//  - Las imágenes de Flux se secuencian según la duración de cada escena.
//  - La narración LMNT suena en bucle único durante todo el video.
//  - Si hay audioClips (MORALEJA), se sincronizan múltiples pistas de audio.
//  - Los subtítulos Popis se renderizan por palabra, sincronizados.
// ============================================================

export const MainVideo: React.FC<RemotionInputProps> = ({
  scenes,
  subtitles,
  audioPath,
  totalDurationSec,
  audioClips,
  musicPath,
  meta,
}) => {
  let cursor = 0; // cursor acumulado en segundos

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* --- Capa de imágenes por escena --- */}
      {scenes.map((scene) => {
        const from = cursor;
        const durationInFrames = Math.max(1, Math.round(scene.duration * FPS));
        const fromFrame = Math.round(from * FPS);
        cursor = from + scene.duration;
        return (
          <Sequence
            key={scene.id}
            from={fromFrame}
            durationInFrames={durationInFrames}
            name={`Escena ${scene.id}`}
          >
            <SceneImage scene={scene} />
          </Sequence>
        );
      })}

      {/* --- Capa de subtítulos Popis --- */}
      {subtitles.map((sub) => {
        const from = Math.round(sub.start * FPS);
        const duration = Math.max(
          1,
          Math.round((sub.end - sub.start) * FPS)
        );
        return (
          <Sequence
            key={sub.id}
            from={from}
            durationInFrames={duration}
            name={`Sub ${sub.id}`}
          >
            <PopisSubtitle subtitle={sub} />
          </Sequence>
        );
      })}

      {/* --- Capa de audio --- */}
      {/* Audio único (BÍBLICA) */}
      {audioPath && (!audioClips || audioClips.length === 0) ? (
        <Audio src={audioPath} />
      ) : null}

      {/* Múltiples clips de audio con offset (MORALEJA) */}
      {audioClips && audioClips.length > 0
        ? audioClips.map((clip, i) => (
            <Sequence
              key={`audio_${i}`}
              from={Math.round(clip.startSec * FPS)}
              durationInFrames={Math.max(1, Math.round(clip.durationSec * FPS))}
            >
              <Audio src={clip.path} />
            </Sequence>
          ))
        : null}

      {/* --- Música de fondo cristiana (loop, volumen 10%) --- */}
      {musicPath ? (
        <Audio src={musicPath} volume={0.1} loop />
      ) : null}

      {/* --- Marca de agua: nombre del canal (abajo-derecha) --- */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "flex-end",
          padding: "0 32px 48px 32px",
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: "rgba(255,255,255,0.6)",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            letterSpacing: 0.5,
          }}
        >
          {meta?.channelName || "Canal Cristiano"}
        </span>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default MainVideo;
