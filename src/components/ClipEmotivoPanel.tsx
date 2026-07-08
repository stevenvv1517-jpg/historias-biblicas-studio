"use client";

import React, { useRef, useState } from "react";
import { VideoPreview } from "@/components/VideoPreview";
import type { ClipEmotivoProject, ClipEmotivoPlayerConfig } from "@/lib/types";

// ============================================================
//  ClipEmotivoPanel — UI para la categoría CLIP EMOTIVO.
//
//   1. Upload de video (mp4/mov/avi)
//   2. Tema/descripción del contenido
//   3. Procesar → /api/clip-emotivo
//      (upload + análisis Groq + FFmpeg trim + Deepgram subtítulos)
//   4. Preview en vivo con <Player/> (composición ClipVideo)
//   5. Render MP4 → /api/render (compositionId: ClipVideo)
//   6. Descargar MP4
// ============================================================

type Phase = "idle" | "processing" | "rendering" | "done" | "error";

export const ClipEmotivoPanel: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [project, setProject] = useState<ClipEmotivoProject | null>(null);
  const [videoPath, setVideoPath] = useState<string>("");

  const playerConfig: ClipEmotivoPlayerConfig | null = project
    ? project.playerConfig
    : null;

  // ---------- Handlers de archivo ----------
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setSelectedFile(f);
    setProject(null);
    setVideoPath("");
  }

  // ---------- PROCESAR ----------
  async function handleProcess() {
    if (!selectedFile) return;
    setPhase("processing");
    setError("");
    setStatus("Subiendo video + análisis emocional (Groq) + recorte (FFmpeg) + subtítulos (Deepgram)…");
    setProject(null);
    setVideoPath("");

    try {
      const form = new FormData();
      form.append("video", selectedFile);
      form.append("topic", topic || selectedFile.name);

      const res = await fetch("/api/clip-emotivo", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Procesamiento falló.");

      setProject(data.project);
      setStatus(
        `✅ “${data.project.analysis.title}” · ${data.stats.trimmedDuration}s clip · ${data.stats.subtitlesCount} subtítulos · música: ${data.stats.musicUsed}`
      );
      setPhase("done");
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
      setPhase("error");
    }
  }

  // ---------- RENDER MP4 ----------
  async function handleRender() {
    if (!project) return;
    setPhase("rendering");
    setError("");
    setStatus("Renderizando MP4 con Remotion…");

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputProps: project.playerConfig.inputProps,
          totalDurationSec: project.playerConfig.durationInFrames / project.playerConfig.fps,
          compositionId: "ClipVideo",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Render falló.");

      setVideoPath(data.videoPath);
      setStatus(`✅ MP4 listo: ${data.frames} frames @ ${data.fps}fps`);
      setPhase("done");
    } catch (e: any) {
      setError(e?.message ?? "Error de render");
      setPhase("error");
    }
  }

  const busy = phase === "processing" || phase === "rendering";

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-8">
      {/* ---------- Panel izquierdo: formulario ---------- */}
      <section className="space-y-6">
        <div className="rounded-2xl border border-studio-border bg-studio-panel/60 backdrop-blur p-6 space-y-5">
          {/* Upload */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Archivo de video (película/serie)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-studio-border hover:border-studio-accent transition p-8 text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFile ? (
                <div>
                  <div className="text-3xl mb-2">🎬</div>
                  <div className="font-medium">{selectedFile.name}</div>
                  <div className="text-xs text-studio-muted mt-1">
                    {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
              ) : (
                <div className="text-studio-muted text-sm">
                  Haz clic para seleccionar un video
                  <div className="text-xs mt-1">MP4 · MOV · AVI · MKV</div>
                </div>
              )}
            </div>
          </div>

          {/* Tema */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Tema / descripción del contenido
            </label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-lg bg-studio-bg border border-studio-border px-4 py-2.5 outline-none focus:border-studio-accent transition"
              placeholder="Ej: predicación sobre la fe, escena de perdón, milagro…"
            />
            <p className="mt-1 text-xs text-studio-muted">
              Groq usa este tema para identificar el segmento más emotivo.
            </p>
          </div>

          {/* Botones */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleProcess}
              disabled={busy || !selectedFile}
              className="px-5 py-2.5 rounded-lg bg-studio-accent hover:bg-studio-accent/90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
            >
              {phase === "processing" ? "Procesando…" : "① Procesar clip"}
            </button>

            <button
              onClick={handleRender}
              disabled={busy || !project}
              className="px-5 py-2.5 rounded-lg bg-studio-accent2 text-studio-bg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
            >
              {phase === "rendering" ? "Renderizando…" : "② Renderizar MP4"}
            </button>

            {videoPath && (
              <a
                href={videoPath}
                download
                className="px-5 py-2.5 rounded-lg border border-studio-border hover:border-studio-accent font-semibold transition"
              >
                ⬇ Descargar MP4
              </a>
            )}
          </div>

          {(status || error) && (
            <div
              className={`text-sm rounded-lg px-4 py-3 border ${
                error
                  ? "bg-red-500/10 border-red-500/30 text-red-300"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              }`}
            >
              {error || status}
            </div>
          )}
        </div>

        {/* Detalles del análisis */}
        {project && (
          <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-6 space-y-3">
            <h3 className="font-semibold">Análisis emocional (Groq)</h3>
            <div className="text-sm text-studio-muted space-y-1.5">
              <p>
                <span className="text-studio-text">Título:</span>{" "}
                {project.analysis.title}
              </p>
              <p>
                <span className="text-studio-text">Segmento:</span>{" "}
                {project.analysis.startTime}s → {project.analysis.endTime}s (
                {project.analysis.durationSec}s)
              </p>
              <p>
                <span className="text-studio-text">Resumen:</span>{" "}
                {project.analysis.summary}
              </p>
              <div className="pt-1">
                <span className="text-studio-text">Color grading:</span>
                <pre className="mt-1 text-xs bg-studio-bg rounded p-2 overflow-x-auto">
{JSON.stringify(project.analysis.colorGrading, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---------- Panel derecho: preview ---------- */}
      <aside className="space-y-4">
        <h2 className="font-semibold text-lg">Vista previa</h2>
        {playerConfig ? (
          <VideoPreview config={playerConfig} />
        ) : (
          <div className="w-full max-w-[360px] mx-auto aspect-[9/16] rounded-2xl border border-dashed border-studio-border grid place-items-center text-center px-6">
            <div className="text-studio-muted text-sm">
              Sube un video y pulsa <b>Procesar clip</b> para ver aquí la
              previsualización.
            </div>
          </div>
        )}
        <p className="text-xs text-studio-muted text-center">
          Clip vertical 1080×1920 · 30fps · música 12% volumen
        </p>
      </aside>
    </div>
  );
};

export default ClipEmotivoPanel;
