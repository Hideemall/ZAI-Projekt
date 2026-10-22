import { HttpProblem } from "../errors.js";

// Niepoprawny lub zbyt duży identyfikator traktujemy jak nieistniejący zasób (404), nie jak błąd SQL.
export function parseId(raw: string): string {
  if (!/^[1-9]\d{0,17}$/.test(raw)) throw new HttpProblem(404, "Not Found", "Resource does not exist");
  return raw;
}