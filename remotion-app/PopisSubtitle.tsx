import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { PopisSubtitle as PopisSubtitleData } from "../src/lib/types";

// ============================================================
//  PopisSubtitle — render del subtítulo estilo "Popis".
//
//  Estilo: cada palabra aparece con un pop animado (escala + opacidad),
//  texto blanco con borde y sombra, palabra activa resaltada en color
//  de acento. Karaoke por palabra sincronizado con Deepgram.
// ============================================================

interface PopisSubtitleProps {
  subtitle: PopisSubtitleData;
}

export const PopisSubtitle: React.FC<PopisSubtitleProps> = ({ subtitle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = Math.round(subtitle.start * fps);
  const endFrame = Math.round(subtitle.end * fps);
  const subDurationFrames = endFrame - startFrame;

  // Fade general del bloque cuando está terminando.
  const canFade = subDurationFrames >= 6;
  const blockOpacity = canFade
    ? interpolate(
        frame,
        [0, Math.min(4, Math.floor(subDurationFrames / 4)), subDurationFrames - 4, subDurationFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 1;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 220,
        opacity: blockOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 10,
          maxWidth: "85%",
        }}
      >
        {subtitle.words.map((word, i) => {
          const wordStartLocal = Math.round(word.start * fps) - startFrame;
          // Spring de aparición por palabra (efecto "pop").
          const pop = spring({
            frame: frame - wordStartLocal,
            fps,
            config: { damping: 12, stiffness: 200, mass: 0.6 },
          });
          const scale = interpolate(pop, [0, 1], [0.5, 1]);
          const opacity = interpolate(pop, [0, 1], [0, 1]);
          const isPunctuation = /[.,;:!?]$/.test(word.text);
          const marginLeft = i > 0 && isPunctuation ? -6 : 0;

          return (
            <span
              key={i}
              style={{
                fontFamily: "system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 58,
                lineHeight: 1.1,
                color: "#ffffff",
                textTransform: "uppercase",
                WebkitTextStroke: "2px rgba(0,0,0,0.85)",
                paintOrder: "stroke fill",
                textShadow: "0 4px 18px rgba(0,0,0,0.6)",
                transform: `scale(${scale})`,
                opacity,
                marginLeft,
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default PopisSubtitle;
