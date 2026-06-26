import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { VisualScene } from "../src/lib/types";

// ============================================================
//  SceneImage — muestra UNA escena con animación Ken Burns / pan.
//  Recibe el tiempo local (desde el inicio de su Sequence).
// ============================================================

interface SceneImageProps {
  scene: VisualScene;
}

export const SceneImage: React.FC<SceneImageProps> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const { motion, intensity } = scene.animationSettings;
  const t = durationInFrames === 0 ? 0 : frame / durationInFrames; // 0..1

  // Transformaciones suaves según el tipo de movimiento.
  let scale = 1.1;
  let translateX = 0;
  let translateY = 0;

  const amt = intensity * 100;

  switch (motion) {
    case "ken-burns-in":
      scale = interpolate(t, [0, 1], [1.05, 1.05 + intensity]);
      break;
    case "ken-burns-out":
      scale = interpolate(t, [0, 1], [1.05 + intensity, 1.05]);
      break;
    case "pan-left":
      translateX = interpolate(t, [0, 1], [amt, -amt]);
      scale = 1.15;
      break;
    case "pan-right":
      translateX = interpolate(t, [0, 1], [-amt, amt]);
      scale = 1.15;
      break;
    case "static":
    default:
      scale = 1.08;
  }

  // Fade-in / fade-out al borde de la escena.
  // Si la escena es muy corta (<6 frames), no hacemos fade
  const canFade = durationInFrames >= 6;
  const opacity = canFade
    ? interpolate(
        frame,
        [0, Math.min(8, Math.floor(durationInFrames / 4)), durationInFrames - 8, durationInFrames],
        [0, 1, 1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      )
    : 1;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Img
        src={scene.localPath}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity,
          transform: `scale(${scale}) translateX(${translateX}px) translateY(${translateY}px)`,
        }}
      />
      {/* Viñeta cinematográfica */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

export default SceneImage;
