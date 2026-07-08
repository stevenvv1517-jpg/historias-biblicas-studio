"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { VideoPreview } from "@/components/VideoPreview";
import { ClipEmotivoPanel } from "@/components/ClipEmotivoPanel";
import type {
  RemotionPlayerConfig,
  VideoProject,
  VideoCategory,
} from "@/lib/types";

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
  versiculo: [
    "Fe y esperanza",
    "Amor y compasión",
    "Perdón y reconciliación",
    "Paz en tiempos difíciles",
    "Fortaleza ante la adversidad",
    "Gratitud y alabanza",
  ],
};

type Phase = "idle" | "generating" | "rendering" | "done" | "error";
type AppMode = "generacion" | "clip-emotivo";

interface HistoryEntry {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  durationSec: number;
  scenes: number;
  subtitles: number;
  b2Url: string;
  localPath: string;
}

export default function StudioPage() {
  const { data: session, status } = useSession();
  const loading = status === "loading";

  const [mode, setMode] = useState<AppMode>("generacion");
  const [category, setCategory] = useState<VideoCategory>("biblica");
  const [topic, setTopic] = useState<string>("La creación del mundo");
  const [speed, setSpeed] = useState<number>(1);
  const [channelName, setChannelName] = useState<string>(
    session?.user?.name || ""
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [project, setProject] = useState<VideoProject | null>(null);
  const [videoPath, setVideoPath] = useState<string>("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const sampleTopics = SAMPLE_TOPICS[category];

  const playerConfig: RemotionPlayerConfig | null = useMemo(() => {
    if (!project) return null;
    return project.remotionPlayerConfig;
  }, [project]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.ok) setHistory(data.history);
    } catch {}
  }, []);

  useEffect(() => {
    if (session) fetchHistory();
  }, [session, fetchHistory]);

  useEffect(() => {
    if (session?.user?.name && !channelName) {
      setChannelName(session.user.name);
    }
  }, [session, channelName]);

  async function handleGenerate() {
    setPhase("generating");
    setError("");
    setStatusMsg("Generado… espere unos minutos");
    setProject(null);
    setVideoPath("");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, category, speed, channelName }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Pipeline falló.");

      setProject(data.project);
      const extra = data.stats.dialoguesTotal
        ? ` · ${data.stats.dialoguesTotal} diálogos`
        : "";
      setStatusMsg(
        `✅ "${data.stats.title}" · ${data.stats.scenes} escenas · ${data.stats.subtitles} subtítulos · ${data.stats.durationSec}s${extra}`
      );
      setPhase("done");
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
      setPhase("error");
    }
  }

  async function handleRender() {
    if (!project) return;
    setPhase("rendering");
    setError("");
    setStatusMsg("Renderizando MP4… esto puede tardar.");

    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputProps: project.remotionPlayerConfig.inputProps,
          totalDurationSec: project.audioConfig.durationSec ?? 0,
          compositionId: project.remotionPlayerConfig.compositionName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Render falló.");

      setVideoPath(data.videoPath);
      setStatusMsg(`✅ MP4 listo: ${data.frames} frames @ ${data.fps}fps`);
      setPhase("done");

      if (data.b2Uploaded) {
        fetchHistory();
      }
    } catch (e: any) {
      setError(e?.message ?? "Error de render");
      setPhase("error");
    }
  }

  const busy = phase === "generating" || phase === "rendering";

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-studio-muted text-sm">Cargando…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-studio-accent to-studio-accent2 grid place-items-center font-black text-white text-3xl">
            ✝
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Historias Bíblicas Studio
          </h1>
          <p className="text-studio-muted max-w-md text-sm sm:text-base">
            Inicia sesión con Google para crear y guardar tus videos bíblicos
            con narración IA, imágenes Flux y subtítulos automáticos.
          </p>
          <button
            onClick={() => signIn("google")}
            className="flex items-center gap-3 px-6 py-3 rounded-xl bg-white text-studio-bg font-semibold hover:brightness-110 transition shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Iniciar sesión con Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
      {/* Header */}
      <header className="mb-6 sm:mb-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-studio-accent to-studio-accent2 grid place-items-center font-black text-white text-lg shrink-0">
              {category === "biblica" ? "✝" : category === "moraleja" ? "✦" : "🙏"}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {category === "biblica" ? "Historias Bíblicas Studio" : category === "moraleja" ? "Moralejas Studio" : "Versículos con Reflexión"}
              </h1>
              <p className="text-xs sm:text-sm text-studio-muted">
                Solo por motor hecho por IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full"
                />
              )}
              <span className="text-xs sm:text-sm text-studio-muted truncate max-w-[120px] sm:max-w-[200px]">
                {session.user?.name}
              </span>
            </div>
            <button
              onClick={() => signOut()}
              className="text-xs px-3 py-1.5 rounded-lg border border-studio-border hover:border-studio-accent text-studio-muted hover:text-studio-text transition shrink-0"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="mb-6 sm:mb-8 flex gap-2 p-1.5 rounded-xl bg-studio-panel/40 border border-studio-border w-fit">
        <button
          type="button"
          onClick={() => setMode("generacion")}
          className={`px-4 sm:px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm transition ${
            mode === "generacion"
              ? "bg-studio-accent text-white"
              : "text-studio-muted hover:text-studio-text"
          }`}
        >
          🎬 Generación IA
        </button>
        <button
          type="button"
          onClick={() => setMode("clip-emotivo")}
          className={`px-4 sm:px-5 py-2 rounded-lg font-semibold text-xs sm:text-sm transition ${
            mode === "clip-emotivo"
              ? "bg-studio-accent2 text-studio-bg"
              : "text-studio-muted hover:text-studio-text"
          }`}
        >
          ✂️ Clip Emotivo
        </button>
      </div>

      {/* CLIP EMOTIVO */}
      {mode === "clip-emotivo" ? (
        <ClipEmotivoPanel />
      ) : (
      <div className="grid lg:grid-cols-[1fr_400px] gap-6 sm:gap-8">
        <section className="space-y-6">
          <div className="rounded-2xl border border-studio-border bg-studio-panel/60 backdrop-blur p-4 sm:p-6 space-y-5">
            {/* Categoría */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Categoría
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setCategory("biblica"); setTopic(SAMPLE_TOPICS.biblica[0]); }}
                  className={`px-3 py-2.5 rounded-lg border font-semibold text-xs sm:text-sm transition ${
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
                  className={`px-3 py-2.5 rounded-lg border font-semibold text-xs sm:text-sm transition ${
                    category === "moraleja"
                      ? "bg-studio-accent2/20 border-studio-accent2 text-studio-accent2"
                      : "border-studio-border text-studio-muted hover:border-studio-accent"
                  }`}
                >
                  ✦ Moraleja
                </button>
                <button
                  type="button"
                  onClick={() => { setCategory("versiculo"); setTopic(""); }}
                  className={`px-3 py-2.5 rounded-lg border font-semibold text-xs sm:text-sm transition ${
                    category === "versiculo"
                      ? "bg-amber-500/20 border-amber-500 text-amber-400"
                      : "border-studio-border text-studio-muted hover:border-amber-500"
                  }`}
                >
                  🙏 Versículo
                </button>
              </div>
            </div>

            {/* Tema */}
            <div>
              <label className="block text-sm font-medium mb-2">
                {category === "biblica" ? "Tema bíblico" : category === "moraleja" ? "Tema de la moraleja" : "Tema (opcional)"}
              </label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg bg-studio-bg border border-studio-border px-4 py-2.5 outline-none focus:border-studio-accent transition text-sm"
                placeholder={category === "biblica" ? "Ej: David y Goliat" : category === "moraleja" ? "Ej: El perdón entre padre e hija" : "Ej: Fe y esperanza"}
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

            {/* Nombre del canal */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre del canal <span className="text-studio-muted font-normal">(marca de agua)</span>
              </label>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full rounded-lg bg-studio-bg border border-studio-border px-4 py-2.5 outline-none focus:border-studio-accent transition text-sm"
                placeholder="Tu nombre de canal"
              />
            </div>

            {/* Velocidad */}
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

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={handleGenerate}
                disabled={busy || topic.trim().length < 3}
                className="px-5 py-2.5 rounded-lg bg-studio-accent hover:bg-studio-accent/90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition flex items-center gap-2"
              >
                {phase === "generating" ? (
                  <><Spinner size="sm" /> Generando…</>
                ) : (
                  "① Generar video"
                )}
              </button>
              <button
                onClick={handleRender}
                disabled={busy || !project}
                className="px-5 py-2.5 rounded-lg bg-studio-accent2 text-studio-bg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition flex items-center gap-2"
              >
                {phase === "rendering" ? (
                  <><Spinner size="sm" /> Renderizando…</>
                ) : (
                  "② Renderizar MP4"
                )}
              </button>
              {videoPath && (
                <a
                  href={videoPath}
                  download
                  className="px-5 py-2.5 rounded-lg border border-studio-border hover:border-studio-accent font-semibold transition"
                >
                  ⬇ Descargar
                </a>
              )}
            </div>

            {/* Status / Error */}
            {(statusMsg || error) && (
              <div
                className={`text-sm rounded-lg px-4 py-3 border ${
                  error
                    ? "bg-red-500/10 border-red-500/30 text-red-300"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                }`}
              >
                {error || statusMsg}
              </div>
            )}
          </div>

          {/* Guion generado */}
          {project && (
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-4 sm:p-6">
              <h3 className="font-semibold mb-1 text-sm sm:text-base">
                {project.category === "moraleja" ? "Diálogos generados" : "Guion generado"} por Groq
              </h3>
              <p className="text-xs text-studio-muted mb-3">
                Título:{" "}
                <span className="text-studio-text">
                  {project.remotionPlayerConfig.inputProps.meta?.title}
                </span>
                {project.visualScenes[0]?.dialogues && (
                  <span className="ml-3">
                    · {project.visualScenes[0].dialogues.length} intervenciones
                  </span>
                )}
              </p>
              {project.category === "moraleja" &&
              project.visualScenes.some((s) => s.dialogues) ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {project.visualScenes.map((scene, si) =>
                    scene.dialogues?.map((d, di) => (
                      <div key={`${si}_${di}`} className="flex gap-2 text-xs sm:text-sm leading-relaxed">
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
                <p className="text-xs sm:text-sm leading-relaxed text-studio-text/90 whitespace-pre-wrap max-h-64 overflow-y-auto">
                  {project.audioConfig.script}
                </p>
              )}
            </div>
          )}

          {/* Resumen */}
          {project && (
            <div className="rounded-2xl border border-studio-border bg-studio-panel/40 p-4 sm:p-6">
              <h3 className="font-semibold mb-3 text-sm sm:text-base">Resumen</h3>
              <ul className="text-xs sm:text-sm text-studio-muted space-y-1.5">
                <li><span className="text-studio-text">ID:</span> {project.id}</li>
                <li>
                  <span className="text-studio-text">Duración:</span>{" "}
                  {project.audioConfig.durationSec}s ·{" "}
                  {project.remotionPlayerConfig.durationInFrames} frames
                </li>
                <li><span className="text-studio-text">Escenas:</span> {project.visualScenes.length}</li>
                <li>
                  <span className="text-studio-text">Subtítulos:</span>{" "}
                  {project.remotionPlayerConfig.inputProps.subtitles.length}
                </li>
                <li>
                  <span className="text-studio-text">Audio:</span>{" "}
                  <code className="text-studio-accent2 text-xs">{project.audioConfig.localPath}</code>
                </li>
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <h2 className="font-semibold text-base sm:text-lg">Vista previa</h2>
          {playerConfig ? (
            <VideoPreview config={playerConfig} />
          ) : (
            <div className="w-full max-w-[360px] mx-auto aspect-[9/16] rounded-2xl border border-dashed border-studio-border grid place-items-center text-center px-6">
              <div className="text-studio-muted text-sm">
                Escribe un tema y pulsa <b>Generar video</b> para ver la
                previsualización aquí.
              </div>
            </div>
          )}
          <p className="text-xs text-studio-muted text-center">
            Preview idéntico al render final · 1080×1920 · 30fps
          </p>
        </aside>
      </div>
      )}

      {/* HISTORIAL */}
      <section className="mt-12 sm:mt-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">
            📜 Mis videos
          </h2>
          {history.length > 0 && (
            <span className="text-xs sm:text-sm text-studio-muted">
              {history.length} video{history.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-studio-border bg-studio-panel/20 p-8 sm:p-10 text-center">
            <p className="text-studio-muted text-sm">
              Aún no tienes videos. Crea tu primer video arriba y aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-studio-border bg-studio-panel/40 p-5 hover:border-studio-accent/50 transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      entry.category === "biblica"
                        ? "bg-studio-accent/20 text-studio-accent"
                        : entry.category === "moraleja"
                          ? "bg-studio-accent2/20 text-studio-accent2"
                          : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {entry.category === "biblica" ? "📖 Bíblica" : entry.category === "moraleja" ? "✦ Moraleja" : "🙏 Versículo"}
                  </span>
                  <span className="text-[10px] text-studio-muted">
                    {new Date(entry.createdAt).toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <h3 className="font-semibold text-sm leading-snug mb-2 line-clamp-2">
                  {entry.title}
                </h3>

                <div className="flex gap-3 text-xs text-studio-muted mb-3">
                  <span>{entry.durationSec.toFixed(0)}s</span>
                  <span>{entry.scenes} escenas</span>
                  <span>{entry.subtitles} subtítulos</span>
                </div>

                {entry.b2Url ? (
                  <a
                    href={entry.b2Url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-studio-accent/10 text-studio-accent hover:bg-studio-accent/20 transition"
                  >
                    ⬇ Descargar
                  </a>
                ) : (
                  <a
                    href={entry.localPath}
                    download
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-studio-accent/10 text-studio-accent hover:bg-studio-accent/20 transition"
                  >
                    ⬇ Descargar
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Spinner({ size = "md" }: { size?: "sm" | "md" }) {
  const cls = size === "sm" ? "w-4 h-4 border-2" : "w-8 h-8 border-3";
  return (
    <span
      className={`inline-block ${cls} border-studio-accent/30 border-t-studio-accent rounded-full animate-spin`}
    />
  );
}
