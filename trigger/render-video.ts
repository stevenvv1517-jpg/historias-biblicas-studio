import { task } from "@trigger.dev/sdk/v3";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

export const renderVideoTask = task({
  id: "render-video",
  run: async (payload: {
    inputProps: Record<string, unknown>;
    totalDurationSec: number;
    compositionId: string;
    videoId: string;
  }) => {
    const { inputProps, totalDurationSec, compositionId, videoId } = payload;

    const projectRoot = process.env.PROJECT_ROOT ?? process.cwd();
    const outputPath = path.join("/tmp", "assets", "videos", `${videoId}.mp4`);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    console.log(`[render-video] Bundling Remotion…`);
    const serveUrl = await bundle({
      entryPoint: path.join(projectRoot, "remotion-app", "index.tsx"),
      onProgress: (p) => console.log(`[render-video] bundle ${p}%`),
    });

    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: inputProps as any,
    });

    const fps = composition.fps;
    const durationInFrames = Math.max(1, Math.round(totalDurationSec * fps));

    console.log(`[render-video] Rendering ${durationInFrames} frames @ ${fps}fps`);
    await renderMedia({
      composition: { ...composition, durationInFrames },
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      imageFormat: "jpeg",
      crf: 18,
      audioCodec: "aac",
      onProgress: ({ progress }) =>
        console.log(`[render-video] ${Math.round(progress * 100)}%`),
    });

    console.log(`[render-video] Video rendered: ${outputPath}`);

    return { videoPath: outputPath, videoId, frames: durationInFrames, fps };
  },
});
