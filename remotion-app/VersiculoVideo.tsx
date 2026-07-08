import React, { useState, useEffect, useRef } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { PopisSubtitle } from "./PopisSubtitle";
import type { PopisSubtitle as PopisSubtitleType } from "../src/lib/types";

interface VersiculoInputProps {
  verseText: string;
  verseReference: string;
  reflection: string;
  audioPath: string;
  videoUrl: string;
  musicPath?: string;
  totalDurationSec: number;
  channelName?: string;
  subtitles?: PopisSubtitleType[];
  [key: string]: unknown;
}

function waitForVideo(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.oncanplaythrough = () => resolve();
    video.onerror = () => reject(new Error(`No se pudo cargar video: ${url}`));
    video.src = url;
    video.load();
  });
}

export const VersiculoVideo: React.FC<VersiculoInputProps> = ({
  verseText,
  verseReference,
  reflection,
  audioPath,
  videoUrl,
  musicPath,
  totalDurationSec,
  channelName,
  subtitles,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [videoReady, setVideoReady] = useState(false);
  const waitHandleRef = useRef<number | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setVideoReady(true);
      return;
    }
    const handle = delayRender("Waiting for video");
    waitHandleRef.current = handle;
    waitForVideo(videoUrl)
      .then(() => {
        setVideoReady(true);
        if (waitHandleRef.current) continueRender(waitHandleRef.current);
      })
      .catch(() => {
        setVideoReady(true);
        if (waitHandleRef.current) continueRender(waitHandleRef.current);
      });
    return () => {
      if (waitHandleRef.current) continueRender(waitHandleRef.current);
    };
  }, [videoUrl]);

  if (!videoReady) return null;

  const totalFrames = Math.round(totalDurationSec * fps);

  // Fade in / fade out del versículo
  const verseOpacity = interpolate(frame, [0, 15, totalFrames - 15, totalFrames], [0, 1, 1, 0]);

  // La reflexión aparece después de un tercio del video
  const reflectionStart = Math.round(totalFrames * 0.35);
  const reflectionOpacity = interpolate(
    frame,
    [reflectionStart, reflectionStart + 15, totalFrames - 15, totalFrames],
    [0, 1, 1, 0]
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Video de fondo */}
      {videoUrl && (
        <Sequence durationInFrames={totalFrames}>
          <AbsoluteFill>
            <video
              src={videoUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              loop
              muted
            />
          </AbsoluteFill>
        </Sequence>
      )}

      {/* Overlay oscuro para legibilidad */}
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.5) 100%)",
        }}
      />

      {/* Versículo (parte superior) */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "60px 40px",
          opacity: verseOpacity,
        }}
      >
        <span
          style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 700,
            fontSize: 48,
            color: "#fff",
            textShadow: "0 4px 20px rgba(0,0,0,0.9)",
            textAlign: "center",
            lineHeight: 1.4,
            maxWidth: "90%",
          }}
        >
          "{verseText}"
        </span>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 28,
            color: "rgba(255,255,255,0.8)",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            marginTop: 20,
          }}
        >
          — {verseReference}
        </span>
      </AbsoluteFill>

      {/* Reflexión (parte inferior, aparece después) */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          padding: "0 40px 100px 40px",
          opacity: reflectionOpacity,
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontWeight: 400,
            fontSize: 32,
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 2px 16px rgba(0,0,0,0.8)",
            textAlign: "center",
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          {reflection}
        </span>
      </AbsoluteFill>

      {/* Subtítulos Popis sincronizados con el audio */}
      {subtitles?.map((sub) => {
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

      {/* Marca de agua del canal */}
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
            color: "rgba(255,255,255,0.5)",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            letterSpacing: 0.5,
          }}
        >
          {channelName || "Canal Cristiano"}
        </span>
      </AbsoluteFill>

      {/* Audio narrado */}
      {audioPath && (
        <Audio src={audioPath} />
      )}

      {/* Música de fondo */}
      {musicPath && (
        <Audio src={musicPath} volume={0.1} loop />
      )}
    </AbsoluteFill>
  );
};

export default VersiculoVideo;
