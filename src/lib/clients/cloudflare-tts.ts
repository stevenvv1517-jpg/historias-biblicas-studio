import fs from "node:fs/promises";
import path from "node:path";

function getAuth() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId)
    throw new Error("Faltan CLOUDFLARE_API_TOKEN o CLOUDFLARE_ACCOUNT_ID.");
  return { token, accountId };
}

async function cloudflareFetch(model: string, body: any): Promise<Buffer> {
  const { token, accountId } = getAuth();
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudflare ${model} ${res.status}: ${errText}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const json: any = await res.json();
    const audioUrl = json?.result?.url || json?.result?.audio?.url;
    if (audioUrl) {
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error(`Fallo al descargar audio de ${audioUrl}`);
      return Buffer.from(await audioRes.arrayBuffer());
    }
    const b64 = json?.result?.audio || json?.audio;
    if (b64) return Buffer.from(b64, "base64");
    throw new Error(`Cloudflare ${model}: respuesta JSON sin audio.`);
  }

  return Buffer.from(await res.arrayBuffer());
}

function estimateDuration(text: string, bytes: number): number {
  const fromText = Math.max(1, text.length / 15);
  const fromBytes = Math.max(1, bytes / 16000);
  return Number(((fromText + fromBytes) / 2).toFixed(2));
}

// Voces disponibles en Aura-2 Español
export const AURA_SPEAKERS = [
  "aquila", "sirio", "nestor", "carina", "celeste",
  "alvaro", "diana", "selena", "estrella", "javier",
] as const;

// Voces disponibles en Inworld TTS 2
export const INWORLD_VOICES = [
  "Loretta", "Darlene", "Marlene", "Hank", "Evelyn",
  "Celeste", "Pippa", "Tessa", "Liam", "Callum",
  "Hamish", "Abby", "Graham", "Rupert", "Mortimer",
  "Snik", "Anjali", "Saanvi", "Arjun", "Claire",
  "Oliver", "Simon", "Elliot", "James", "Serena",
  "Gareth", "Vinny", "Lauren", "Jessica", "Ethan",
  "Tyler", "Jason", "Chloe", "Veronica", "Victoria",
  "Miranda", "Sebastian", "Victor", "Malcolm", "Nate",
  "Brian", "Amina", "Kelsey", "Derek", "Evan",
  "Kayla", "Jake", "Grant", "Tristan", "Nadia",
  "Selene", "Marcus", "Riley", "Damon", "Cedric",
  "Mia", "Naomi", "Jonah", "Levi", "Avery",
  "Brandon", "Conrad", "Bianca", "Lucian", "Trevor",
  "Alex", "Ashley", "Craig", "Deborah", "Dennis",
  "Edward", "Elizabeth", "Hades", "Julia", "Pixie",
  "Mark", "Olivia", "Priya", "Ronald", "Sarah",
  "Shaun", "Theodore", "Timothy", "Wendy", "Dominus",
  "Hana", "Clive", "Carter", "Blake", "Luna",
  "Reed", "Duncan", "Felix", "Eleanor", "Sophie",
  "Angus", "Asteria", "Arcas", "Orion", "Orpheus",
  "Athena", "Luna", "Zeus", "Perseus", "Helios",
  "Hera", "Stella",
] as const;

const AURA_MAX_CHARS = 2000; // límite del modelo

function splitIntoChunks(text: string, maxLen: number): string[] {
  const parts = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if ((current + " " + part).trim().length <= maxLen) {
      current = (current + " " + part).trim();
    } else {
      if (current) chunks.push(current);
      current = part;
      // si una parte aislada excede el límite, corta por fuerza bruta
      while (current.length > maxLen) {
        chunks.push(current.slice(0, maxLen));
        current = current.slice(maxLen);
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Sintetiza voz usando Deepgram Aura-2 Español (ideal para historias bíblicas).
 * Modelo: @cf/deepgram/aura-2-es
 * Si el texto excede 2000 caracteres, lo divide en fragmentos y los concatena.
 */
export async function synthesizeAura2({
  text,
  speaker = "aquila",
  outputPath,
}: {
  text: string;
  speaker?: string;
  outputPath: string;
}): Promise<{ path: string; durationSec: number; bytes: number }> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  if (text.length <= AURA_MAX_CHARS) {
    const buf = await cloudflareFetch("@cf/deepgram/aura-2-es", {
      text,
      speaker,
      encoding: "mp3",
    });
    await fs.writeFile(outputPath, buf);
    return {
      path: outputPath,
      durationSec: estimateDuration(text, buf.length),
      bytes: buf.length,
    };
  }

  // Dividir y sintetizar cada fragmento
  const chunks = splitIntoChunks(text, AURA_MAX_CHARS);
  const bufs: Buffer[] = [];
  let totalBytes = 0;
  let totalDuration = 0;

  for (let i = 0; i < chunks.length; i++) {
    const buf = await cloudflareFetch("@cf/deepgram/aura-2-es", {
      text: chunks[i],
      speaker,
      encoding: "mp3",
    });
    bufs.push(buf);
    totalBytes += buf.length;
    totalDuration += estimateDuration(chunks[i], buf.length);
  }

  const combined = Buffer.concat(bufs);
  await fs.writeFile(outputPath, combined);

  return {
    path: outputPath,
    durationSec: totalDuration,
    bytes: totalBytes,
  };
}

/**
 * Sintetiza voz usando Inworld TTS 2 (ideal para moralejas con diálogos).
 * Modelo: inworld/tts-2
 */
export async function synthesizeInworld({
  text,
  voiceId = "Dennis",
  speed = 1,
  outputPath,
}: {
  text: string;
  voiceId?: string;
  speed?: number;
  outputPath: string;
}): Promise<{ path: string; durationSec: number; bytes: number }> {
  const buf = await cloudflareFetch("inworld/tts-2", {
    text,
    voice_id: voiceId,
    output_format: "mp3",
    speaking_rate: speed,
    temperature: 1,
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, buf);

  return {
    path: outputPath,
    durationSec: estimateDuration(text, buf.length),
    bytes: buf.length,
  };
}

/**
 * Dispatcher: elige el modelo de TTS según la categoría.
 *   - "biblica"  → Aura-2 (voz "aquila" por defecto)
 *   - "moraleja" → Inworld (voz según género)
 */
export async function synthesizeCloudflareTTS({
  text,
  category = "biblica",
  gender,
  speed = 1,
  outputPath,
}: {
  text: string;
  category?: "biblica" | "moraleja";
  gender?: "hombre" | "mujer";
  speed?: number;
  outputPath: string;
}): Promise<{ path: string; durationSec: number; bytes: number }> {
  if (category === "moraleja") {
    const voiceId = gender === "mujer" ? "Claire" : "Dennis";
    return synthesizeInworld({ text, voiceId, speed, outputPath });
  }
  return synthesizeAura2({ text, speaker: "aquila", outputPath });
}
