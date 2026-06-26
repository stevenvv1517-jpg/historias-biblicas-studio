import { Composition, registerRoot } from "remotion";
import { MainVideo } from "./MainVideo";
import type { RemotionInputProps } from "../src/lib/types";
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../src/lib/pipeline";

// ============================================================
//  Registro de la composición para `remotion studio` y `@remotion/renderer`.
//  Cuando se renderiza por CLI o por la API route /api/render, este archivo
//  es el entrypoint. Los inputProps reales llegan en runtime.
// ============================================================

const defaultProps: RemotionInputProps = {
  scenes: [],
  subtitles: [],
  audioPath: "",
  totalDurationSec: 10,
};

const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={Math.round(10 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
