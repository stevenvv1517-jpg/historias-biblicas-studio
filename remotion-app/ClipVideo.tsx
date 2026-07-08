import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import type { ClipEmotivoInputProps } from "../src/lib/types";
import { PopisSubtitle } from "./PopisSubtitle";
import { FPS } from "../src/lib/pipeline";

// ============================================================
//  ClipVideo — composición para CLIP EMOTIVO.
//
//  Renderiza:
//   - El video recortado (con audio original) a pantalla completa
//   - Música cristiana de fondo (mezclada por Remotion al 12%)
//   - Título de impacto en la parte superior
//   - Subtítulos Popis sincronizados con Deepgram
//   - Color grading cinematográfico vía CSS filters
// ============================================================

/**
 * Construye la cadena de CSS filter para el color grading.
 * brightness, contrast, saturate, sepia (para warmth).
 */
function buildColorFilter(cg: ClipEmotivoInputProps["colorGrading"]): string {
  if (!cg) return "none";
  const parts: string[] = [];
  if (cg.brightness !== undefined)
    parts.push(`brightness(${1 + cg.brightness})`);
  if (cg.contrast !== undefined) parts.push(`contrast(${cg.contrast})`);
  if (cg.saturation !== undefined) parts.push(`saturate(${cg.saturation})`);
  // warmth: simulamos calidez con un toque de sepia + hue
  if (cg.warmth !== undefined)
    parts.push(`sepia(${(cg.warmth - 1) * 0.15})`);
  return parts.length ? parts.join(" ") : "none";
}

export const ClipVideo: React.FC<ClipEmotivoInputProps> = ({
  videoPath,
  musicPath,
  title,
  subtitles,
  totalDurationSec,
  colorGrading,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const filter = buildColorFilter(colorGrading);

  // --- Animaciones del título ---
  const titleEnter = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
  });
  const titleY = interpolate(titleEnter, [0, 1], [-60, 0]);
  const titleOpacity = interpolate(titleEnter, [0, 1], [0, 1]);

  // Fade-out final del video completo.
  const endFade = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* --- Capa de video a pantalla completa --- */}
      <AbsoluteFill style={{ opacity: endFade }}>
        <OffthreadVideo
          src={staticFile(videoPath.replace(/^\//, ""))}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter,
          }}
        />
      </AbsoluteFill>

      {/* --- Música cristiana de fondo (12% volumen) --- */}
      {musicPath ? (
        <Audio
          src={staticFile(musicPath.replace(/^\//, ""))}
          volume={0.12}
          // La música dura lo mismo que el clip
          endAt={durationInFrames}
        />
      ) : null}

      {/* --- Título de impacto (parte superior) --- */}
      {title ? (
        <AbsoluteFill
          style={{
            justifyContent: "flex-start",
            alignItems: "center",
            paddingTop: 90,
            opacity: titleOpacity * endFade,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div
            style={{
              maxWidth: "80%",
              textAlign: "center",
            }}
          >
            <span
              style={{
                fontFamily: "system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 46,
                lineHeight: 1.1,
                color: "#ffffff",
                textTransform: "uppercase",
                WebkitTextStroke: "2px rgba(0,0,0,0.8)",
                paintOrder: "stroke fill",
                textShadow: "0 4px 16px rgba(0,0,0,0.7)",
                letterSpacing: 0.5,
              }}
            >
              {title}
            </span>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* --- Subtítulos Popis (centro-inferior) --- */}
      {subtitles.map((sub) => {
        const from = Math.round(sub.start * fps);
        const duration = Math.max(1, Math.round((sub.end - sub.start) * fps));
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

      {/* --- Degradado superior para legibilidad del título --- */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 25%)",
          pointerEvents: "none",
          opacity: endFade,
        }}
      />
    </AbsoluteFill>
  );
};

export default ClipVideo;
