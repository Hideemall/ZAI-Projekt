import type { FastifyRequest } from "fastify";
import { pool } from "../db/pool.js";
import { HttpProblem } from "../errors.js";
import { sha256 } from "../services/crypto.js";

declare module "fastify" {
  interface FastifyRequest {
    sensor?: { id: string; seriesId: string };
  }
}

// Token admina nie wystarcza: tu liczy się wyłącznie hash klucza z tabeli sensors.
export async function requireSensor(req: FastifyRequest): Promise<void> {
  const key = req.headers["x-api-key"];
  if (typeof key !== "string" || key === "") {
    throw new HttpProblem(401, "Unauthorized", "X-API-Key header required");
  }
  const { rows } = await pool.query<{ id: string; series_id: string }>(
    "SELECT id, series_id FROM sensors WHERE api_key_hash = $1",
    [sha256(key)],
  );
  const [row] = rows;
  if (!row) throw new HttpProblem(401, "Unauthorized", "Invalid API key");
  req.sensor = { id: row.id, seriesId: row.series_id };
}