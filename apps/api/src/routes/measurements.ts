import type { FastifyPluginAsync } from "fastify";
import { HttpProblem } from "../errors.js";
import { requireSensor } from "../middleware/requireSensor.js";
import { parseId } from "../services/ids.js";
import {
  addMeasurement,
  getMeasurement,
  queryMeasurements,
  type MeasurementQuery,
} from "../services/measurements.js";

const bodySchema = {
  type: "object",
  required: ["value"],
  properties: {
    value: { type: "number" },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

type RawQuery = Record<string, string | string[] | undefined>;

const ID = /^[1-9]\d{0,17}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;

const bad = (field: string, message: string) =>
  new HttpProblem(400, "Bad Request", "Invalid query parameter", [{ field, message }]);

function single(q: RawQuery, name: string): string | undefined {
  const v = q[name];
  if (Array.isArray(v)) throw bad(name, "must be given only once");
  return v;
}

function parseDate(q: RawQuery, name: string): Date | undefined {
  // Niezakodowany "+" w query string jest dekodowany jako spacja.
  const raw = single(q, name)?.replace(" ", "+");
  if (raw === undefined) return undefined;
  if (!ISO_DATE_TIME.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw bad(name, "must be an ISO 8601 date-time with timezone");
  }
  return new Date(raw);
}

function parseQuery(q: RawQuery): MeasurementQuery {
  const rawSeries = single(q, "series");
  const seriesIds = rawSeries?.split(",").map((s) => {
    const id = s.trim();
    if (!ID.test(id)) throw bad("series", "must be a comma-separated list of series ids");
    return id;
  });

  const from = parseDate(q, "from");
  const to = parseDate(q, "to");
  if (from && to && from > to) throw bad("from", "must not be later than 'to'");

  const sort = single(q, "sort") ?? "timestamp";
  if (sort !== "timestamp" && sort !== "-timestamp") throw bad("sort", "must be 'timestamp' or '-timestamp'");

  const rawLimit = single(q, "limit") ?? "1000";
  const limit = Number(rawLimit);
  if (!/^\d+$/.test(rawLimit) || limit < 1 || limit > 10000) throw bad("limit", "must be an integer 1-10000");

  return { seriesIds, from, to, descending: sort === "-timestamp", limit };
}

export const measurementRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: RawQuery }>("/", (req) => queryMeasurements(parseQuery(req.query)));

  app.get<{ Params: { measurementId: string } }>("/:measurementId", (req) =>
    getMeasurement(parseId(req.params.measurementId)),
  );

  app.post<{ Body: { value: number; timestamp?: string } }>(
    "/",
    { onRequest: requireSensor, schema: { body: bodySchema } },
    async (req, reply) => {
      const m = await addMeasurement(req.sensor!, req.body.value, req.body.timestamp);
      return reply.code(201).header("Location", `/api/measurements/${m.id}`).send(m);
    },
  );
};