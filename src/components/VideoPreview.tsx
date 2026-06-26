"use client";

import React from "react";
import { Player } from "@remotion/player";
import { MainVideo } from "../../remotion-app/MainVideo";
import type { RemotionPlayerConfig } from "@/lib/types";

// ============================================================
//  VideoPreview — wrapper cliente del <Player/> de Remotion.
//  Recibe la configuración completa generada por /api/pipeline.
// ============================================================

interface VideoPreviewProps {
  config: RemotionPlayerConfig;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ config }) => {
  return (
    <div className="w-full max-w-[360px] mx-auto aspect-[9/16] rounded-2xl overflow-hidden border border-studio-border shadow-2xl shadow-black/50 bg-black">
      <Player
        component={MainVideo}
        durationInFrames={config.durationInFrames}
        compositionWidth={config.width}
        compositionHeight={config.height}
        fps={config.fps}
        inputProps={config.inputProps}
        style={{ width: "100%", height: "100%" }}
        controls
        loop
        autoPlay
      />
    </div>
  );
};

export default VideoPreview;
