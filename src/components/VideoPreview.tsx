"use client";

import React from "react";
import { Player } from "@remotion/player";
import { MainVideo } from "../../remotion-app/MainVideo";
import { ClipVideo } from "../../remotion-app/ClipVideo";
import type {
  RemotionPlayerConfig,
  ClipEmotivoPlayerConfig,
} from "@/lib/types";

// ============================================================
//  VideoPreview — wrapper cliente del <Player/> de Remotion.
//  Recibe la configuración completa generada por la API.
//  Soporta ambas composiciones: MainVideo (BÍBLICA/MORALEJA)
//  y ClipVideo (CLIP EMOTIVO).
// ============================================================

type AnyPlayerConfig = RemotionPlayerConfig | ClipEmotivoPlayerConfig;

interface VideoPreviewProps {
  config: AnyPlayerConfig;
}

function isClipConfig(
  config: AnyPlayerConfig
): config is ClipEmotivoPlayerConfig {
  return config.compositionName === "ClipVideo";
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ config }) => {
  const Component = isClipConfig(config) ? ClipVideo : MainVideo;
  return (
    <div className="w-full max-w-[360px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden border border-studio-border shadow-2xl shadow-black/50 bg-black">
      <Player
        component={Component as any}
        durationInFrames={config.durationInFrames}
        compositionWidth={config.width}
        compositionHeight={config.height}
        fps={config.fps}
        inputProps={config.inputProps as any}
        style={{ width: "100%", height: "100%" }}
        controls
        loop
        autoPlay
      />
    </div>
  );
};

export default VideoPreview;
