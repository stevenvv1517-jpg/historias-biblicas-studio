import { Config } from "@remotion/cli/config";

// ============================================================
//  Configuración global para `remotion render` / `remotion studio`.
//  Usada por `npm run studio` y `npm run render`.
// ============================================================

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setConcurrency(null); // auto-detectar núcleos
Config.setCodec("h264");

// El entrypoint de Remotion es remotion-app/index.tsx
Config.setEntryPoint("remotion-app/index.tsx");
