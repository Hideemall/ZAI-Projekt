import { pool } from "../db/pool.js";
import { withTransaction } from "../db/tx.js";
import { HttpProblem } from "../errors.js";

export interface SeriesInput {
  name: string;
  minValue: number;
  maxValue: number;
  color: string;
  icon?: string | null;
  unit?: string | null;
}

export interface Series {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  color: string;
  icon: string | null;
  unit: string | null;
}

interface SeriesRow {
  id: string;
  name: string;
  min_value: number;
  max_value: number;
  color: string;
  icon: string | null;
  unit: string | null;
}

const COLUMNS = "id, name, min_value, max_value, color, icon, unit";
const notFound = () => new HttpProblem(404, "Not Found", "Series does not exist");

const toSeries = (r: SeriesRow): Series => ({
  id: r.id,
  name: r.name,
  minValue: r.min_value,
  maxValue: r.max_value,
  color: r.color,
  icon: r.icon,
  unit: r.unit,
});

export function assertRange(input: SeriesInput): void {
  if (input.minValue >= input.maxValue) {
    throw new HttpProblem(422, "Unprocessable Content", "minValue must be less than maxValue", [
      { field: "minValue", message: "must be less than maxValue" },
    ]);
  }
}

export async function listSeries(): Promise<Series[]> {
  const { rows } = await pool.query<SeriesRow>(`SELECT ${COLUMNS} FROM series ORDER BY id`);
  return rows.map(toSeries);
}

export async function getSeries(id: string): Promise<Series> {
  const { rows } = await pool.query<SeriesRow>(`SELECT ${COLUMNS} FROM series WHERE id = $1`, [id]);
  const [row] = rows;
  if (!row) throw notFound();
  return toSeries(row);
}

export async function createSeries(input: SeriesInput): Promise<Series> {
  const { rows } = await pool.query<SeriesRow>(
    `INSERT INTO series (name, min_value, max_value, color, icon, unit)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [input.name, input.minValue, input.maxValue, input.color, input.icon ?? null, input.unit ?? null],
  );
  return toSeries(rows[0] as SeriesRow);
}

export function updateSeries(id: string, input: SeriesInput): Promise<Series> {
  return withTransaction(async (client) => {
    // Blokada wiersza serii: równoległy zapis wyniku poczeka na koniec zmiany przedziału.
    const locked = await client.query("SELECT 1 FROM series WHERE id = $1 FOR UPDATE", [id]);
    if (!locked.rowCount) throw notFound();

    const outside = await client.query(
      "SELECT 1 FROM measurements WHERE series_id = $1 AND (value < $2 OR value > $3) LIMIT 1",
      [id, input.minValue, input.maxValue],
    );
    if (outside.rowCount) {
      throw new HttpProblem(409, "Conflict", "New range would exclude already stored measurements");
    }

    const { rows } = await client.query<SeriesRow>(
      `UPDATE series SET name = $2, min_value = $3, max_value = $4, color = $5, icon = $6, unit = $7
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, input.name, input.minValue, input.maxValue, input.color, input.icon ?? null, input.unit ?? null],
    );
    return toSeries(rows[0] as SeriesRow);
  });
}

// Kaskada w bazie usuwa czujniki i wyniki serii.
export async function deleteSeries(id: string): Promise<void> {
  const res = await pool.query("DELETE FROM series WHERE id = $1", [id]);
  if (!res.rowCount) throw notFound();
}