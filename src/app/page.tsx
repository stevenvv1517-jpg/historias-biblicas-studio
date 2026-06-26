"use client";

import React, { useMemo, useState } from "react";
import { VideoPreview } from "@/components/VideoPreview";
import type {
  RemotionPlayerConfig,
  VideoProject,
  VideoCategory,
} from "@/lib/types";

// ============================================================
//  StudioPage — UI principal del estudio.
//
//  El usuario selecciona CATEGORÍA y escribe un TEMA.
//  Groq genera el guion + las escenas visuales; después corre el
//  pipeline LMNT + Deepgram + Flux; finalmente se renderiza a MP4.
// ============================================================

const SAMPLE_TOPICS: Record<VideoCategory, string[]> = {
  biblica: [
    "La creación del mundo",
    "David y Goliat",
    "El arca de Noé",
    "Jonás y la ballena",
    "Los milagros de Jesús",
    "El éxodo de Egipto",
  ],
  moraleja: [
    "El perdón entre padre e hija",
    "La honestidad de un niño",
    "La generosidad en tiempos difíciles",
    "Dos hermanos y la envidia",
    "El valor de la amistad",
    "La paciencia de un maestro",
  ],
};

type Phase = "idle" | "generating" | "rendering" | "done" | "error";

export default function StudioPage() {
  const [category, setCategory] = useState<VideoCategory>("biblica");
  const [topic, setTopic] = useState<string>("La creación del mundo");
  const [sceneCount, setSceneCount] = useState<number>(6);
  const [speed, setSpeed] = useState<number>(1);

  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [project, setProject] = useState<VideoProject | null>(null);
  const [videoPath, setVideoPath] = useState<string>("");

  const sampleTopics = SAMPLE_TOPICS[category];

  const playerConfig: RemotionPlayerConfig | null = useMemo(() => {
    if (!project) return null;
    return project.remotionPlayerConfig;
  }, [project]);

  // ---------- GENERAR ----------
  async function handleGenerate() {
    setPhase("generating");
    setError("");
    setStatus(
      "Groq escribiendo el guion → LMNT (voz) + Deepgram (subtítulos) + Flux (imágenes)…"
    );
    setProject(null);
    setVideoPath("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, category, sceneCount, speed }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Pipeline falló.");

      setProject(data.project);
      const extra = data.stats.dialoguesTotal
        ? ` · ${data.stats.dialoguesTotal} diálogos`
        : "";
      setStatus(
        `✅ “${data.stats.title}” · ${data.stats.scenes} escenas · ${data.stats.subtitles} subtítulos · ${data.stats.durationSec}s${extra}`
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
    setStatus("Renderizando MP4 con @remotion/renderer… esto puede tardar.");

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputProps: project.remotionPlayerConfig.inputProps,
          totalDurationSec: project.audioConfig.durationSec ?? 0,
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

  const busy = phase === "generating" || phase === "rendering";

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-studio-accent to-studio-accent2 grid place-items-center font-black text-white text-lg">
            {category === "biblica" ? "✝" : "✦"}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {category === "biblica" ? "Historias Bíblicas Studio" : "Moralejas Studio"}
            </h1>
            <p className="text-sm text-studio-muted">
              Groq · LMNT · Deepgram · Cloudflare Flux · Remotion → MP4
            </p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        {/* ---------- Panel izquierdo: formulario ---------- */}
        <section className="space-y-6">
          <div className="rounded-2xl border border-studio-border bg-studio-panel/60 backdrop-blur p-6 space-y-5">
            {/* Selector de categoría */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Categoría
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setCategory("biblica"); setTopic(SAMPLE_TOPICS.biblica[0]); }}
                  className={`px-4 py-2.5 rounded-lg border font-semibold text-sm transition ${
                    category === "biblica"
                      ? "bg-studio-accent/20 border-studio-accent text-studio-accent"
                      : "border-studio-border text-studio-muted hover:border-studio-accent"
                  }`}
                >
                  📖 Bíblica
                </button>
                <button
                  type="button"
                  onClick={() => { setCategory("moraleja"); setTopic(SAMPLE_TOPICS.moraleja[0]); }}
                  className={`px-4 py-2.5 rounded-lg border font-semibold text-sm transition ${
                    category === "moraleja"
                      ? "bg-studio-accent2/20 border-studio-accent2 text-studio-accent2"
                      : "border-studio-border text-studio-muted hover:border-studio-accent"
                  }`}
                >
                  ✦ Moraleja
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {category === "biblica" ? "Tema bíblico" : "Tema de la moraleja"}
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg bg-studio-bg border border-studio-border px-4 py-2.5 outline-none focus:border-studio-accent transition"
                placeholder={category === "biblica" ? "Ej: David y Goliat" : "Ej: El perdón entre padre e hija"}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {sampleTopics.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    className="text-xs px-2.5 py-1 rounded-full border border-studio-border hover:border-studio-accent text-studio-muted hover:text-studio-text transition"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Escenas: {sceneCount}
                </label>
                <input
                  type="range"
                  min={4}
                  max={9}
                  step={1}
                  value={sceneCount}
                  onChange={(e) => setSceneCount(Number(e.target.value))}
                  className="w-full accent-studio-accent mt-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Velocidad: {speed.toFixed(2)}x
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  className="w-full accent-studio-accent mt-3"
                />
              </div>
            </div>

            {category === "biblica" && (
              <p className="text-xs text-studio-muted">
                La voz se define con <code className="text-studio-accent2">LMNT_VOICE_ID</code> en{" "}
                <code className="text-studio-accent2">.env.local</code>.
              </p>
            )}
            {category === "moraleja" && (
              <p className="text-xs text-studio-muted">
                Los diálogos alternan automáticamente entre voces hombre y mujer según los personajes.
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleGenerate}
                disabled={busy || topic.trim().length < 3}
                className="px-5 py-2.5 rounded-lg bg-studio-accent hover:bg-studio-accent/90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition"
              >
                {phase === "generating" ? "Generando…" : "① Generar video"}
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

          {/* Guion generado */}
          {project && (
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-6">
              <h3 className="font-semibold mb-1">
                {project.category === "moraleja" ? "Diálogos generados" : "Guion generado"} por Groq
              </h3>
              <p className="text-xs text-studio-muted mb-3">
                Título: <span className="text-studio-text">
                  {project.remotionPlayerConfig.inputProps.meta?.title}
                </span>
                {project.visualScenes[0]?.dialogues && (
                  <span className="ml-3">
                    · {project.visualScenes[0].dialogues.length} intervenciones
                  </span>
                )}
              </p>
              {project.category === "moraleja" && project.visualScenes.some(s => s.dialogues) ? (
                <div className="space-y-2">
                  {project.visualScenes.map((scene, si) =>
                    scene.dialogues?.map((d, di) => (
                      <div
                        key={`${si}_${di}`}
                        className="flex gap-2 text-sm leading-relaxed"
                      >
                        <span
                          className={`font-bold shrink-0 ${
                            d.gender === "mujer" ? "text-pink-400" : "text-cyan-400"
                          }`}
                        >
                          [{d.gender === "mujer" ? "Voz Mujer" : "Voz Hombre"}]
                        </span>
                        <span className="text-studio-text/90">{d.line}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-studio-text/90 whitespace-pre-wrap">
                  {project.audioConfig.script}
                </p>
              )}
            </div>
          )}

          {/* Detalles técnicos */}
          {project && (
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-6">
              <h3 className="font-semibold mb-3">Resumen del proyecto</h3>
              <ul className="text-sm text-studio-muted space-y-1.5">
                <li>
                  <span className="text-studio-text">ID:</span> {project.id}
                </li>
                <li>
                  <span className="text-studio-text">Duración:</span>{" "}
                  {project.audioConfig.durationSec}s ·{" "}
                  {project.remotionPlayerConfig.durationInFrames} frames
                </li>
                <li>
                  <span className="text-studio-text">Escenas:</span>{" "}
                  {project.visualScenes.length}
                </li>
                <li>
                  <span className="text-studio-text">Subtítulos Popis:</span>{" "}
                  {project.remotionPlayerConfig.inputProps.subtitles.length}
                </li>
                <li>
                  <span className="text-studio-text">Audio:</span>{" "}
                  <code className="text-studio-accent2">
                    {project.audioConfig.localPath}
                  </code>
                </li>
              </ul>
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
                Escribe un tema bíblico y pulsa <b>Generar video</b> para ver
                aquí la previsualización en vivo con el Player de Remotion.
              </div>
            </div>
          )}
          <p className="text-xs text-studio-muted text-center">
            Preview idéntico al render final · 1080×1920 · 30fps
          </p>
        </aside>
      </div>
    </main>
  );
}
