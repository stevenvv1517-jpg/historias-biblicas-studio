const PEXELS_API_KEY = process.env.PEXELS_API_KEY ?? "";

const NATURE_QUERIES = [
  "nature", "forest", "waterfall", "mountains", "sunset",
  "ocean", "river", "trees", "sky", "meadow",
  "flowers", "lake", "stars", "clouds", "rain",
  "dawn", "garden", "landscape", "sea", "woodland",
];

export interface PexelsVideo {
  url: string;
  width: number;
  height: number;
  duration: number;
  thumbnail: string;
}

/**
 * Busca un video de naturaleza aleatorio en Pexels.
 * Retorna el primer resultado vertical (9:16 o cercano) o el primero disponible.
 */
export async function fetchNatureVideo(): Promise<PexelsVideo> {
  if (!PEXELS_API_KEY) {
    throw new Error("Falta PEXELS_API_KEY en el entorno.");
  }

  const query = NATURE_QUERIES[Math.floor(Math.random() * NATURE_QUERIES.length)];
  const orientation = "portrait";
  const perPage = 10;

  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}`;

  const res = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Pexels ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  const videos: any[] = data?.videos ?? [];

  if (videos.length === 0) {
    throw new Error("Pexels: no se encontraron videos.");
  }

  // Buscar el primer video vertical (9:16 aprox)
  const vertical = videos.find(
    (v: any) =>
      v.width < v.height &&
      v.video_files?.length > 0
  );
  const chosen = vertical || videos[0];
  const files: any[] = chosen?.video_files ?? [];
  // Preferir el archivo con quality "hd" o "sd", resolución más cercana a 1080x1920
  const best = files.find((f: any) => f.quality === "hd" && f.width < f.height)
    || files.find((f: any) => f.width < f.height)
    || files[0];

  if (!best?.link) {
    throw new Error("Pexels: video sin archivo descargable.");
  }

  return {
    url: best.link,
    width: best.width || chosen.width,
    height: best.height || chosen.height,
    duration: chosen.duration || 15,
    thumbnail: chosen.image || "",
  };
}
