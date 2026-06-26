// ============================================================
//  Cliente Groq — LLM de velocidad extrema (Llama 3.3 70B, etc.)
//  Endpoint: POST https://api.groq.com/openai/v1/chat/completions
//  Compatible con la API de OpenAI.
//
//  Aquí se usa para:
//   - Generar el guion narrativo completo a partir de un tema.
//   - Generar las descripciones visuales por escena para Flux.
//   - Generar diálogos con personajes (categoría MORALEJA).
// ============================================================

export interface GroqScenePlan {
  /** Descripción visual limpia (sin plantilla cinematográfica). */
  description: string;
  /** Narración que acompañará a esta escena (parte del audio total). */
  narration: string;
  /** Animación sutil para Flux1 (ej: "slow zoom", "blinking", "natural head movement"). */
  animation?: string;
  /** Efectos de sonido ambientales para esta escena. */
  sfx?: { at: number; label: string }[];
  /** Solo MORALEJA: diálogos de personajes en esta escena. */
  dialogues?: { character: string; gender: "hombre" | "mujer"; line: string }[];
}

export interface GroqPlanResult {
  title: string;
  fullNarration: string;
  scenes: GroqScenePlan[];
}

export interface GroqPlanParams {
  topic: string;
  sceneCount?: number; // 4..8 recomendado
  language?: string; // "es"
  category: "biblica" | "moraleja";
}

const DEFAULT_MODEL =
  process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

/**
 * Pide a Groq un plan completo según la categoría.
 * - BÍBLICA: narración épica con escenas visuales.
 * - MORALEJA: diálogos entre personajes con alternancia de voz.
 */
export async function planBiblicalVideo({
  topic,
  sceneCount = 6,
  language = "es",
  category = "biblica",
}: GroqPlanParams): Promise<GroqPlanResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Falta GROQ_API_KEY en el entorno.");

  const isMoraleja = category === "moraleja";

  const systemPrompt = isMoraleja
    ? `Eres un guionista experto en videos de moraleja con diálogos (formato reel/TikTok 9:16).
Tu tarea es producir un plan de video para el tema que te dé el usuario.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin markdown.
- Idioma de salida: ${language}.
- La historia debe tener una MORALEJA clara al final.
- Entre ${Math.max(3, sceneCount - 1)} y ${sceneCount + 1} escenas.
- Cada escena debe tener una "description" visual cinematográfica realista, con personajes en acción.
- Cada escena debe incluir "dialogues": un array de objetos con { character, gender ("hombre"|"mujer"), line }.
- Alterna el género de los diálogos: si hay dos personajes, que uno sea "hombre" y otro "mujer".
- Cada escena debe tener también "animation" con el tipo de movimiento sutil para Flux1 (ej: "slow zoom in", "natural head movement", "blinking", "gentle pan", "breathing").
- Opcionalmente incluye "sfx": array de { at (segundo dentro de la escena), label (descripción del sonido) }.
- El "title" debe ser corto y evocador.
- La "fullNarration" debe ser la concatenación de todas las líneas de diálogo formando el audio completo.

FORMATO DE SALIDA:
{
  "title": "string",
  "fullNarration": "string (concatenación de todos los diálogos)",
  "scenes": [
    {
      "description": "string visual sin plantilla",
      "narration": "string (puede incluir diálogo o texto narrativo)",
      "animation": "string (ej: slow zoom)",
      "dialogues": [
        { "character": "string", "gender": "hombre|mujer", "line": "string" }
      ],
      "sfx": [{ "at": number, "label": "string" }]
    }
  ]
}`
    : `Eres un guionista experto en videos bíblicos verticales (formato reel/TikTok 9:16).
Tu tarea es producir un plan de video para el tema que te dé el usuario.

REGLAS ESTRICTAS:
- Responde ÚNICAMENTE con JSON válido, sin texto antes ni después, sin markdown.
- Idioma de salida: ${language}.
- La narración total debe ser fluida, emotiva, fiel al texto bíblico y apta para TTS (sin paréntesis ni acotaciones).
- Entre ${Math.max(4, sceneCount - 1)} y ${sceneCount + 1} escenas.
- Cada escena debe tener una "description" visual apta para un generador de imágenes. IMPORTANTE: las descripciones DEBEN incluir personajes bíblicos (personas) en acción, NO solo fondos o paisajes. Ejemplo correcto: "Adán y Eva caminando en el Jardín del Edén con Dios hablándoles, luz dorada, vegetación exuberante". Ejemplo INCORRECTO: "El Jardín del Edén con árboles y un río" (sin personas).
- Cada escena debe tener "animation" con el tipo de movimiento sutil para Flux1 (ej: "slow zoom in", "natural head movement", "blinking", "gentle pan", "breathing").
- Opcionalmente incluye "sfx": array de { at (segundo dentro de la escena), label (descripción del sonido) }.
- Cada escena debe tener su porción de "narration"; la concatenación de todas las narraciones forma el audio final.
- El "title" debe ser corto y evocador.

FORMATO DE SALIDA:
{
  "title": "string",
  "fullNarration": "string (concatenación de todas las narraciones)",
  "scenes": [
    {
      "description": "string visual sin plantilla",
      "narration": "string",
      "animation": "string (ej: slow zoom)",
      "sfx": [{ "at": number, "label": "string" }]
    }
  ]
}`;

  const res = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Tema del video: ${topic}` },
        ],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq ${res.status}: ${errText}`);
  }

  const json: any = await res.json();
  const content: string = json?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("Groq: respuesta vacía.");

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq: respuesta no es JSON válido.");
  }

  const scenes: GroqScenePlan[] = Array.isArray(parsed?.scenes)
    ? parsed.scenes.map((s: any, i: number) => ({
        description: String(s?.description ?? "").trim(),
        narration: String(s?.narration ?? "").trim(),
        animation: String(s?.animation ?? "").trim() || undefined,
        sfx: Array.isArray(s?.sfx) ? s.sfx : undefined,
        dialogues: isMoraleja && Array.isArray(s?.dialogues)
          ? s.dialogues.map((d: any) => ({
              character: String(d?.character ?? "").trim(),
              gender: d?.gender === "mujer" ? "mujer" as const : "hombre" as const,
              line: String(d?.line ?? "").trim(),
            }))
          : undefined,
      }))
    : [];

  const fullNarration: string =
    String(parsed?.fullNarration ?? "").trim() ||
    scenes.map((s) => s.narration).join(" ");

  if (!fullNarration || scenes.length === 0) {
    throw new Error("Groq: plan vacío o sin escenas.");
  }

  return {
    title: String(parsed?.title ?? topic).trim(),
    fullNarration,
    scenes,
  };
}
