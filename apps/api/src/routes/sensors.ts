import type { FastifyPluginAsync } from "fastify";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { parseId } from "../services/ids.js";
import {
  getSensor,
  listSensors,
  registerSensor,
  unregisterSensor,
  type SensorInput,
} from "../services/sensors.js";

const bodySchema = {
  type: "object",
  required: ["name", "seriesId"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    seriesId: { type: ["integer", "string"] },
  },
} as const;

interface IdParams {
  sensorId: string;
}

export const sensorRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", requireAdmin); // wszystkie ścieżki czujników wymagają admina

  app.get("/", () => listSensors());

  app.get<{ Params: IdParams }>("/:sensorId", (req) => getSensor(parseId(req.params.sensorId)));

  app.post<{ Body: SensorInput }>("/", { schema: { body: bodySchema } }, async (req, reply) => {
    const sensor = await registerSensor(req.body);
    return reply.code(201).header("Location", `/api/sensors/${sensor.id}`).send(sensor);
  });

  app.delete<{ Params: IdParams }>("/:sensorId", async (req, reply) => {
    await unregisterSensor(parseId(req.params.sensorId));
    return reply.code(204).send();
  });
};