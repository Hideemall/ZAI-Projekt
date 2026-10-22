import { parseArgs } from "node:util";

export type Mode = "random" | "sine" | "range";

export interface Config {
  url: string;
  apiKey: string;
  count: number; // 0 = bez końca (tylko --live)
  intervalSec: number;
  mode: Mode;
  min: number;
  max: number;
  live: boolean;
}

export const USAGE = `Usage: npm start -- [options]
  --url <addr>       API base URL (default: $ZAI_API_URL or http://localhost:3000)
  --key <apiKey>     sensor key (default: $ZAI_API_KEY)
  --count <n>        number of measurements (default 20; 0 = endless with --live)
  --interval <sec>   backdated: gap between timestamps (default 60); --live: delay between sends (default 5)
  --mode <m>         random | sine | range (default random)
  --min <x> --max <x>  value range, must match the series (default 0..100)
  --live             send without timestamp (server time) instead of backdated data`;

const MODES: readonly string[] = ["random", "sine", "range"];
export const normalizeUrl = (raw: string): string => new URL(raw).href.replace(/\/(api\/?)?$/, "");
// parseArgs uznaje "-20" za opcję; sklejamy "--min" "-20" w "--min=-20".
function joinNegativeValues(argv: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    const next = argv[i + 1];
    if (arg.startsWith("--") && !arg.includes("=") && next !== undefined && /^-\d/.test(next)) {
      out.push(`${arg}=${next}`);
      i++;
    } else {
      out.push(arg);
    }
  }
  return out;
}


function number(raw: string | undefined, name: string, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}

export function parseConfig(argv: string[], env: NodeJS.ProcessEnv): Config | null {
  const { values } = parseArgs({
    args: joinNegativeValues(argv),
    options: {
      url: { type: "string" },
      key: { type: "string" },
      count: { type: "string" },
      interval: { type: "string" },
      mode: { type: "string" },
      min: { type: "string" },
      max: { type: "string" },
      live: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) return null;

  const apiKey = values.key ?? env.ZAI_API_KEY;
  if (!apiKey) throw new Error("API key missing: set ZAI_API_KEY or pass --key");

  const live = values.live ?? false;
  const count = number(values.count, "count", 20);
  const intervalSec = number(values.interval, "interval", live ? 5 : 60);
  const min = number(values.min, "min", 0);
  const max = number(values.max, "max", 100);
  const mode = values.mode ?? "random";

  if (!MODES.includes(mode)) throw new Error("--mode must be random, sine or range");
  if (!Number.isInteger(count) || count < (live ? 0 : 1)) throw new Error("--count must be a positive integer");
  if (intervalSec <= 0) throw new Error("--interval must be > 0");
  if (min >= max) throw new Error("--min must be less than --max");

  const url = normalizeUrl(values.url ?? env.ZAI_API_URL ?? "http://localhost:3000");

  return { url, apiKey, count, intervalSec, mode: mode as Mode, min, max, live };
}