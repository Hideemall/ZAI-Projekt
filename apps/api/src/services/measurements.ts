import { pool } from "../db/pool.js";
import { withTransaction } from "../db/tx.js";
import { HttpProblem, type FieldError } from "../errors.js";

export interface Measurement {
  id: string;
  seriesId: string;
  sensorId: string | null;
  value: number;
  timestamp: string;
}

export interface MeasurementQuery {
  seriesIds?: string[];
  from?: Date;
  to?: Date;
  descending: boolean;
  limit: number;
}

interface MeasurementRow {
  id: string;
  series_id: string;
  sensor_id: string | null;
  value: number;
  timestamp: Date;
}

const COLUMNS = "id, series_id, sensor_id, value, timestamp";
const MAX_FUTURE_MS = 5 * 60 * 1000;

const toMeasurement = (r: MeasurementRow): Measurement => ({
  id: r.id,
  seriesId: r.series_id,
  sensorId: r.sensor_id,
  value: r.value,
  timestamp: r.timestamp.toISOString(),
});

function checkInput(value: number, ts: Date, min: number, max: number): FieldError | null {
  if (value < min || value > max) return { field: "value", message: `must be within [${min}, ${max}]` };
  if (ts.getTime() > Date.now() + MAX_FUTURE_MS) {
    return { field: "timestamp", message: "must not be more than 5 minutes in the future" };
  }
  // Dolna granica chroni przed datami, których PostgreSQL nie zapisze (np. rok 0).
  if (ts.getTime() < 0) return { field: "timestamp", message: "must not be earlier than 1970-01-01" };
  return null;
}

type Outcome = { kind: "saved"; measurement: Measurement } | { kind: "rejected"; error: FieldError };

export async function addMeasurement(
  sensor: { id: string; seriesId: string },
  value: number,
  timestamp?: string,
): Promise<Measurement> {
  const ts = timestamp ? new Date(timestamp) : new Date();

  const outcome = await withTransaction<Outcome>(async (client) => {
    const locked = await client.query<{ min_value: number; max_value: number }>(
      `SELECT se.min_value, se.max_value
       FROM sensors s JOIN series se ON se.id = s.series_id
       WHERE s.id = $1 FOR SHARE OF s, se`,
      [sensor.id],
    );
    const [range] = locked.rows;
    // Czujnik wyrejestrowany (lub seria usunięta) między uwierzytelnieniem a zapisem.
    if (!range) throw new HttpProblem(401, "Unauthorized", "Sensor is no longer registered");

    const error = checkInput(value, ts, range.min_value, range.max_value);
    if (error) {
      await client.query(
        "INSERT INTO validation_log (series_id, sensor_id, value, timestamp, reason) VALUES ($1, $2, $3, $4, $5)",
        [sensor.seriesId, sensor.id, value, ts.toISOString(), `${error.field}: ${error.message}`],
      );
      return { kind: "rejected", error };
    }

    const { rows } = await client.query<MeasurementRow>(
      `INSERT INTO measurements (series_id, sensor_id, value, timestamp)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [sensor.seriesId, sensor.id, value, ts.toISOString()],
    );
    return { kind: "saved", measurement: toMeasurement(rows[0] as MeasurementRow) };
  });

  // Wyjątek dopiero po COMMIT, żeby wpis w validation_log nie został wycofany.
  if (outcome.kind === "rejected") {
    throw new HttpProblem(422, "Unprocessable Content", "Measurement rejected", [outcome.error]);
  }
  return outcome.measurement;
}

export async function getMeasurement(id: string): Promise<Measurement> {
  const { rows } = await pool.query<MeasurementRow>(`SELECT ${COLUMNS} FROM measurements WHERE id = $1`, [id]);
  const [row] = rows;
  if (!row) throw new HttpProblem(404, "Not Found", "Measurement does not exist");
  return toMeasurement(row);
}

export async function queryMeasurements(q: MeasurementQuery): Promise<Measurement[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };

  if (q.seriesIds) add("series_id = ANY(?::bigint[])", q.seriesIds);
  if (q.from) add("timestamp >= ?", q.from);
  if (q.to) add("timestamp <= ?", q.to);
  params.push(q.limit);

  const dir = q.descending ? "DESC" : "ASC"; // z białej listy, nie z wejścia użytkownika
  const { rows } = await pool.query<MeasurementRow>(
    `SELECT ${COLUMNS} FROM measurements
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY timestamp ${dir}, id ${dir} LIMIT $${params.length}`,
    params,
  );
  return rows.map(toMeasurement);
}