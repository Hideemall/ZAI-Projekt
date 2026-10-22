import { postMeasurement, waitForApi } from "./client.js";
import { normalizeUrl, type Mode } from "./config.js";
import { nextValue } from "./values.js";

interface Plan {
  name: string;
  minValue: number;
  maxValue: number;
  color: string;
  icon: string;
  unit: string;
  mode: Mode;
}

const PLANS: Plan[] = [
  { name: "Temperatura", minValue: -20, maxValue: 50, color: "#1f77b4", icon: "circle", unit: "°C", mode: "sine" },
  { name: "Wilgotność", minValue: 0, maxValue: 100, color: "#d62728", icon: "square", unit: "%", mode: "random" },
  { name: "Ciśnienie", minValue: 950, maxValue: 1050, color: "#2ca02c", icon: "triangle", unit: "hPa", mode: "range" },
];
const POINTS = 24; // 24 punkty = jeden pełny okres sinusoidy
const STEP_SEC = 600;

const url = normalizeUrl(process.env.ZAI_API_URL ?? "http://localhost:3000");
const username = process.env.ZAI_ADMIN_USER;
const password = process.env.ZAI_ADMIN_PASSWORD;
if (!username || !password) {
  console.error("Set ZAI_ADMIN_USER and ZAI_ADMIN_PASSWORD (and optionally ZAI_API_URL)");
  process.exit(2);
}

async function api<T>(method: string, path: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(`${url}/api${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(`${method} ${path} -> ${res.status} ${problem?.detail ?? res.statusText}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

async function run(): Promise<void> {
  await waitForApi(url);
  const { accessToken: token } = await api<{ accessToken: string }>("POST", "/auth/login", undefined, {
    username,
    password,
  });

  try {
    const existing = new Set((await api<{ name: string }[]>("GET", "/series")).map((s) => s.name));
    const startedAt = Date.now();

    for (const { mode, ...seriesInput } of PLANS) {
      if (existing.has(seriesInput.name)) {
        console.log(`skip '${seriesInput.name}' (already exists)`);
        continue;
      }
      const series = await api<{ id: string }>("POST", "/series", token, seriesInput);
      const sensor = await api<{ apiKey: string }>("POST", "/sensors", token, {
        name: `Czujnik: ${seriesInput.name}`,
        seriesId: series.id,
      });

      for (let i = 0; i < POINTS; i++) {
        const value = nextValue(mode, i, POINTS, seriesInput.minValue, seriesInput.maxValue);
        const timestamp = new Date(startedAt - (POINTS - 1 - i) * STEP_SEC * 1000).toISOString();
        const result = await postMeasurement(url, sensor.apiKey, value, timestamp);
        if (!result.ok) throw new Error(`${seriesInput.name} #${i + 1}: ${result.status} ${result.detail}`);
      }
      console.log(`'${seriesInput.name}': series ${series.id}, ${POINTS} measurements`);
    }
  } finally {
    await api("POST", "/auth/logout", token);
  }
}

try {
  await run();
} catch (err) {
  console.error(`Seed failed: ${(err as Error).message}`);
  process.exitCode = 1;
}