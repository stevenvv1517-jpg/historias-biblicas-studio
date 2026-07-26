import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_wibcvffdynhxesccbehc",
  runtime: "node",
  dirs: ["./trigger"],
  maxDuration: 600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 5000,
      maxTimeoutInMs: 30000,
    },
  },
});
