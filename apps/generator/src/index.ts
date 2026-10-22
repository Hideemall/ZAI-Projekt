import { postMeasurement, sleep, waitForApi } from "./client.js";
import { parseConfig, USAGE } from "./config.js";
import { nextValue } from "./values.js";

let config;
try {
  config = parseConfig(process.argv.slice(2), process.env);
} catch (err) {
  console.error(`Error: ${(err as Error).message}\n\n${USAGE}`);
  process.exit(2);
}
if (!config) {
  console.log(USAGE);
  process.exit(0);
}

let stopping = false;
process.once("SIGINT", () => {
  stopping = true; // kolejne Ctrl+C przerywa od razu
});

await waitForApi(config.url);

const startedAt = Date.now();
let sent = 0;
let failed = 0;

for (let i = 0; !stopping && (config.count === 0 || i < config.count); i++) {
  const value = nextValue(config.mode, i, config.count, config.min, config.max);
  // Tryb z przeszłości: ostatni znacznik = teraz, wcześniejsze co intervalSec wstecz.
  const timestamp = config.live
    ? undefined
    : new Date(startedAt - (config.count - 1 - i) * config.intervalSec * 1000).toISOString();

  const result = await postMeasurement(config.url, config.apiKey, value, timestamp);
  if (result.ok) {
    sent++;
    console.log(`#${i + 1} value=${value} ${timestamp ?? "(server time)"} -> id ${result.id}`);
  } else {
    failed++;
    console.error(`#${i + 1} value=${value} -> ${result.status} ${result.detail}`);
    if (result.status === 401) break; // zły lub wyrejestrowany klucz: dalsze próby nie mają sensu
  }
  if (config.live && !stopping) await sleep(config.intervalSec * 1000);
}

console.log(`Done: ${sent} sent, ${failed} failed`);
process.exitCode = failed > 0 ? 1 : 0;