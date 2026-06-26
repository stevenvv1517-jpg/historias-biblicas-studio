# Historias Bíblicas Studio

Generador web de **videos bíblicos verticales (9:16)** con narración IA,
subtítulos automáticos estilo **Popis** y **render final a MP4**.

Stack: **Next.js + React + Remotion** en el frontend/orquestación,
**Groq** (guion + escenas con LLM), **LMNT** (voz), **Deepgram**
(subtítulos word-level) y **Cloudflare Workers AI / Flux** (imágenes
verticales) en el backend.

---

## 🧩 Arquitectura del flujo

```
   Tema bíblico (texto corto)
       │
       ▼
   ┌───────────┐  título + guion + escenas visuales
   │   Groq    │─────────────────────────────┐
   └───────────┘                             │
       │ fullNarration                       │ descriptions
       ▼                                     │
   ┌───────────┐   mp3 + duración            │
   │   LMNT    │─────────────────────┐       │
   └───────────┘                     │       │
       │ audio.mp3                   │       │
       ▼                             │       │
   ┌───────────┐  palabras timed      │       │
   │ Deepgram  │─────┐                │       │
   └───────────┘     │                │       │
                     ▼                ▼       ▼
              subtítulos Popis   escenas (Flux)
                     │                │
                     └────────┬───────┘
                              ▼
                   Remotion <Player/>  (preview en vivo)
                              │
                              ▼
                   @remotion/renderer  →  video.mp4
```

No hay JSON intermedio: el usuario escribe solo un **tema**, Groq redacta
el guion y describe las escenas, y el pipeline corre en el servidor
alimentando directamente el `<Player/>` mediante `inputProps`.

---

## 📁 Estructura de archivos

```
historias biblicas/
├── remotion/                    # Composiciones de Remotion
│   ├── index.tsx                # RemotionRoot (registro MainVideo)
│   ├── MainVideo.tsx            # Composición 1080×1920 @ 30fps
│   ├── SceneImage.tsx           # Imagen con animación Ken Burns / pan
│   └── PopisSubtitle.tsx        # Subtítulo estilo Popis (karaoke por palabra)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── pipeline/route.ts   # Orquesta LMNT + Deepgram + Flux
│   │   │   ├── render/route.ts     # Render MP4 con @remotion/renderer
│   │   │   └── voices/route.ts     # Catálogo de voces LMNT
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx                # UI principal (formulario + Player)
│   ├── components/
│   │   └── VideoPreview.tsx        # Wrapper cliente del <Player/>
│   └── lib/
│       ├── types.ts                # Tipos centrales del pipeline
│       ├── pipeline.ts             # Conversores (s↔frames, Popis, escenas)
│       ├── voices.ts               # Catálogo LMNT
│       ├── paths.ts                # Resolución /public/assets
│       └── clients/
│           ├── groq.ts             # LLM → título + guion + escenas
│           ├── lmnt.ts             # TTS → mp3
│           ├── deepgram.ts         # Transcripción word-level
│           └── cloudflare.ts       # Flux → imagen 9:16
├── public/assets/{audio,images,videos,sfx}/   # activos locales
├── remotion.config.ts
├── next.config.mjs
├── tailwind.config.js
├── package.json
└── .env.example
```

---

## 🚀 Puesta en marcha

### 1) Instalar dependencias

```bash
npm install
```

### 2) Configurar variables de entorno

Copia `.env.example` a `.env.local` y rellena tus claves:

```bash
cp .env.example .env.local
```

Necesitas:

| Variable | Servicio | Cómo obtenerla |
|---|---|---|
| `GROQ_API_KEY` | Guion + escenas (LLM) | https://console.groq.com/keys |
| `GROQ_MODEL` | Modelo LLM | Opcional, default `llama-3.3-70b-versatile` |
| `LMNT_API_KEY` | Voz (TTS) | https://app.lmnt.com/ |
| `DEEPGRAM_API_KEY` | Subtítulos | https://console.deepgram.com/ |
| `CLOUDFLARE_API_TOKEN` | Imágenes Flux | https://dash.cloudflare.com/ → Workers AI |
| `CLOUDFLARE_ACCOUNT_ID` | Imágenes Flux | Panel de tu cuenta de Cloudflare |

### 3) Lanzar en local

```bash
npm run dev
```

Abre http://localhost:3000

1. Escribe un **tema bíblico** corto (ej: "David y Goliat").
2. Elige voz, número de escenas y velocidad.
3. Pulsa **① Generar video** → Groq redacta el guion y describe las escenas; luego LMNT + Deepgram + Flux construyen el preview.
4. Pulsa **② Renderizar MP4** → se genera el archivo final.
5. **⬇ Descargar MP4**.

### (Opcional) Estudio de Remotion por separado

```bash
npm run studio      # abre http://localhost:3001 para depurar composiciones
npm run render      # renderiza MainVideo desde CLI
```

---

## 🎬 Especificación técnica del video

| Parámetro | Valor |
|---|---|
| Resolución | 1080 × 1920 (vertical 9:16) |
| FPS | 30 |
| Codec | H.264 (MP4) |
| Audio | AAC |
| Calidad | CRF 18 (alta) |
| Subtítulos | Popis, karaoke por palabra (Deepgram word-level) |
| Imágenes | Flux, plantilla cinematográfica 8k |

### Plantilla de prompt Flux

```
Cinematic, 8k, highly detailed, <DESCRIPCIÓN>,
dramatic lighting, hyper-realistic,
vertical composition for 9:16 aspect ratio
```

### Cómo se construyen los subtítulos Popis

1. Deepgram devuelve cada palabra con `start` y `end` en segundos.
2. `buildPopisSubtitles()` las agrupa en bloques de ≤4 palabras o ≤1.8 s.
3. `PopisSubtitle.tsx` renderiza cada palabra con un **spring** de escala
   y opacidad (efecto "pop") sincronizado con su timestamp.

---

## 🔒 Local-First

Todos los activos se materializan en `/public/assets/...` y se sirven
como archivos estáticos. El `<Player/>` los consume vía `staticFile()`,
**sin latencia de red ni CORS**. No se usa almacenamiento remoto.

---

## ⚠️ Notas

- El render MP4 requiere **Chromium** (lo descarga `@remotion/renderer`
  automáticamente la primera vez).
- La primera llamada a `/api/render` empaqueta el bundle de Remotion
  (~5–10 s); se cachea en memoria para llamadas siguientes.
- En Windows, ejecuta la terminal como **Git Bash** o **PowerShell**;
  algunos binarios de Remotion funcionan mejor así.
