import { randomBytes } from "node:crypto";
import { pool } from "../db/pool.js";
import { HttpProblem } from "../errors.js";
import { sha256 } from "./crypto.js";

export interface SensorInput {
  name: string;
  seriesId: string | number;
}

export interface Sensor {
  id: string;
  name: string;
  seriesId: string;
  createdAt: string;
  lastMeasurementAt: string | null;
}

export interface SensorCreated extends Sensor {
  apiKey: string;
}

interface SensorRow {
  id: string;
  name: string;
  series_id: string;
  created_at: Date;
  last_measurement_at: Date | null;
}

const SELECT = `
  SELECT s.id, s.name, s.series_id, s.created_at,
         (SELECT max(m.timestamp) FROM measurements m WHERE m.sensor_id = s.id) AS last_measurement_at
  FROM sensors s`;

const FK_VIOLATION = "23503";
const notFound = () => new HttpProblem(404, "Not Found", "Sensor does not exist");

const toSensor = (r: SensorRow): Sensor => ({
  id: r.id,
  name: r.name,
  seriesId: r.series_id,
  createdAt: r.created_at.toISOString(),
  lastMeasurementAt: r.last_measurement_at?.toISOString() ?? null,
});

const seriesNotFound = () =>
  new HttpProblem(422, "Unprocessable Content", "Series does not exist", [
    { field: "seriesId", message: "series does not exist" },
  ]);

export async function listSensors(): Promise<Sensor[]> {
  const { rows } = await pool.query<SensorRow>(`${SELECT} ORDER BY s.id`);
  return rows.map(toSensor);
}

export async function getSensor(id: string): Promise<Sensor> {
  const { rows } = await pool.query<SensorRow>(`${SELECT} WHERE s.id = $1`, [id]);
  const [row] = rows;
  if (!row) throw notFound();
  return toSensor(row);
}

export async function registerSensor(input: SensorInput): Promise<SensorCreated> {
  const seriesId = String(input.seriesId);
  if (!/^[1-9]\d{0,17}$/.test(seriesId)) throw seriesNotFound();

  const apiKey = `zai_${randomBytes(32).toString("base64url")}`;
  try {
    const { rows } = await pool.query<{ id: string; created_at: Date }>(
      "INSERT INTO sensors (name, series_id, api_key_hash) VALUES ($1, $2, $3) RETURNING id, created_at",
      [input.name, seriesId, sha256(apiKey)],
    );
    const [row] = rows;
    if (!row) throw new Error("insert returned no row");
    return {
      id: row.id,
      name: input.name,
      seriesId,
      createdAt: row.created_at.toISOString(),
      lastMeasurementAt: null,
      apiKey, // jedyny moment, w którym klucz opuszcza serwer
    };
  } catch (err) {
    // Naruszenie FK w jednym zapytaniu zamiast SELECT + INSERT (brak wyścigu).
    if ((err as { code?: string }).code === FK_VIOLATION) throw seriesNotFound();
    throw err;
  }
}

export async function unregisterSensor(id: string): Promise<void> {
  const res = await pool.query("DELETE FROM sensors WHERE id = $1", [id]);
  if (!res.rowCount) throw notFound();
}