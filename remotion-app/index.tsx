import { Composition, registerRoot } from "remotion";
import { MainVideo } from "./MainVideo";
import { ClipVideo } from "./ClipVideo";
import { VersiculoVideo } from "./VersiculoVideo";
import type { RemotionInputProps, ClipEmotivoInputProps } from "../src/lib/types";
import { FPS, VIDEO_WIDTH, VIDEO_HEIGHT } from "../src/lib/pipeline";

// ============================================================
//  Registro de composiciones para `remotion studio` y
//  `@remotion/renderer`. Los inputProps reales llegan en runtime
//  vía las API routes /api/pipeline (BÍBLICA) o
//  /api/clip-emotivo (CLIP EMOTIVO) y /api/render (MP4 final).
// ============================================================

const defaultMainProps: RemotionInputProps = {
  scenes: [],
  subtitles: [],
  audioPath: "",
  audioClips: [],
  totalDurationSec: 10,
};

const defaultClipProps: ClipEmotivoInputProps = {
  videoPath: "",
  musicPath: "",
  title: "",
  subtitles: [],
  totalDurationSec: 10,
  colorGrading: { brightness: 0, contrast: 1, saturation: 1, warmth: 1 },
};

const defaultVersiculoProps = {
  verseText: "",
  verseReference: "",
  reflection: "",
  audioPath: "",
  videoUrl: "",
  totalDurationSec: 10,
  subtitles: [],
};

const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composición principal: BÍBLICA / MORALEJA */}
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={Math.round(10 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultMainProps}
      />

      {/* Composición: CLIP EMOTIVO */}
      <Composition
        id="ClipVideo"
        component={ClipVideo}
        durationInFrames={Math.round(10 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultClipProps}
      />

      {/* Composición: VERSÍCULO CON REFLEXIÓN */}
      <Composition
        id="VersiculoVideo"
        component={VersiculoVideo}
        durationInFrames={Math.round(10 * FPS)}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={defaultVersiculoProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
