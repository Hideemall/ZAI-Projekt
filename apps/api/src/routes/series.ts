import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { parseId } from "../services/ids.js";
import {
  assertRange,
  createSeries,
  deleteSeries,
  getSeries,
  listSeries,
  updateSeries,
  type SeriesInput,
} from "../services/series.js";

const bodySchema = {
  type: "object",
  required: ["name", "minValue", "maxValue", "color"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    minValue: { type: "number" },
    maxValue: { type: "number" },
    color: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
    icon: { type: ["string", "null"], maxLength: 50 },
    unit: { type: ["string", "null"], maxLength: 20 },
  },
} as const;

interface IdParams {
  seriesId: string;
}

export const seriesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", () => listSeries());

  app.get<{ Params: IdParams }>("/:seriesId", (req) => getSeries(parseId(req.params.seriesId)));

  app.post<{ Body: SeriesInput }>(
    "/",
    { onRequest: requireAdmin, schema: { body: bodySchema } },
    async (req, reply) => {
      assertRange(req.body);
      const series = await createSeries(req.body);
      return reply.code(201).header("Location", `/api/series/${series.id}`).send(series);
    },
  );

  app.put<{ Params: IdParams; Body: SeriesInput }>(
    "/:seriesId",
    { onRequest: requireAdmin, schema: { body: bodySchema } },
    async (req) => {
      assertRange(req.body);
      return updateSeries(parseId(req.params.seriesId), req.body);
    },
  );

  app.delete<{ Params: IdParams }>("/:seriesId", { onRequest: requireAdmin }, async (req, reply) => {
    await deleteSeries(parseId(req.params.seriesId));
    return reply.code(204).send();
  });
};