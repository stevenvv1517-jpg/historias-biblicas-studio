/**
 * Load Test - Simula 100 peticiones simultáneas al pipeline
 * Ejecutar: node load-test.js [URL] [NUM_USERS]
 * Ejemplo: node load-test.js https://historias-biblicas-studio.vercel.app 100
 */

const BASE_URL = process.argv[2] || "http://localhost:3000";
const NUM_USERS = parseInt(process.argv[3] || "100", 10);
const CONCURRENCY = 10; // peticiones simultáneas por batch

const TOPICS = [
  "La creación del mundo",
  "Adán y Eva en el Jardín del Edén",
  "El arca de Noé",
  "La torre de Babel",
  "Abraham y el sacrificio de Isaac",
  "Moisés y la zarza ardiente",
  "Las diez plagas de Egipto",
  "El cruce del Mar Rojo",
  "Los diez mandamientos",
  "David y Goliat",
  "Jonás y la ballena",
  "Daniel en el foso de los leones",
  "Los tres magos",
  "La natividad de Jesús",
  "La multiplicación de los panes",
  "La resurrección de Lázaro",
  "La Última Cena",
  "La crucifixión de Jesús",
  "La resurrección de Jesús",
  "La Ascensión",
  "Pentecostés",
  "El Good Samaritano",
  "La oveja perdida",
  "El hijo pródigo",
  "Pedro camina sobre el agua",
  "San Pablo en Damasco",
  "El arcoíris de Noé",
  "Sodoma y Gomorra",
  "Jacob y la escalera al cielo",
  "José y sus hermanos",
];

const CATEGORIES = ["biblica", "moraleja", "versiculo"];

function getRandomTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

function getRandomCategory() {
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

async function sendRequest(id) {
  const topic = getRandomTopic();
  const category = getRandomCategory();
  const startTime = Date.now();

  try {
    const res = await fetch(`${BASE_URL}/api/pipeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        category,
        speed: 1,
      }),
    });

    const elapsed = Date.now() - startTime;
    const data = await res.json();

    if (res.ok && data.ok) {
      return {
        id,
        status: "OK",
        topic,
        category,
        elapsed,
        duration: data.stats?.durationSec || 0,
        scenes: data.stats?.scenes || 0,
      };
    } else {
      return {
        id,
        status: "ERROR",
        topic,
        category,
        elapsed,
        error: data.error || `HTTP ${res.status}`,
      };
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    return {
      id,
      status: "FAIL",
      topic,
      category,
      elapsed,
      error: err.message,
    };
  }
}

async function runBatch(startId, count) {
  const promises = [];
  for (let i = 0; i < count; i++) {
    promises.push(sendRequest(startId + i));
  }
  return Promise.all(promises);
}

async function main() {
  console.log(`\n🚀 LOAD TEST: ${NUM_USERS} usuarios simultáneos`);
  console.log(`📍 Target: ${BASE_URL}/api/pipeline`);
  console.log(`⚡ Concurrency: ${CONCURRENCY} por batch\n`);

  const allResults = [];
  const batches = Math.ceil(NUM_USERS / CONCURRENCY);

  for (let b = 0; b < batches; b++) {
    const startId = b * CONCURRENCY;
    const count = Math.min(CONCURRENCY, NUM_USERS - startId);

    process.stdout.write(`Batch ${b + 1}/${batches} (${count} users)... `);

    const results = await runBatch(startId, count);
    allResults.push(...results);

    const ok = results.filter((r) => r.status === "OK").length;
    const err = results.filter((r) => r.status !== "OK").length;
    console.log(`✅ ${ok} OK  ❌ ${err} FAIL`);
  }

  // Estadísticas
  const okResults = allResults.filter((r) => r.status === "OK");
  const failResults = allResults.filter((r) => r.status !== "OK");

  const avgElapsed =
    okResults.length > 0
      ? Math.round(okResults.reduce((s, r) => s + r.elapsed, 0) / okResults.length)
      : 0;
  const maxElapsed = okResults.length > 0 ? Math.max(...okResults.map((r) => r.elapsed)) : 0;
  const minElapsed = okResults.length > 0 ? Math.min(...okResults.map((r) => r.elapsed)) : 0;

  console.log(`\n📊 RESULTADOS:`);
  console.log(`   Total:    ${NUM_USERS}`);
  console.log(`   ✅ OK:    ${okResults.length}`);
  console.log(`   ❌ FAIL:  ${failResults.length}`);
  console.log(`   ⏱  Avg:   ${avgElapsed}ms`);
  console.log(`   ⏱  Min:   ${minElapsed}ms`);
  console.log(`   ⏱  Max:   ${maxElapsed}ms`);

  if (failResults.length > 0) {
    console.log(`\n❌ ERRORES:`);
    const errorCounts = {};
    for (const r of failResults) {
      const key = r.error || "unknown";
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    }
    for (const [err, count] of Object.entries(errorCounts)) {
      console.log(`   ${count}x: ${err}`);
    }
  }

  console.log(`\n✅ Load test completado.`);
}

main().catch(console.error);
