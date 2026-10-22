import Fastify, { type FastifyInstance } from "fastify";
import { registerBodyParsers } from "./middleware/bodyParsers.js";
import { registerProblemHandling } from "./middleware/problem.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { seriesRoutes } from "./routes/series.js";

export function buildApp(): FastifyInstance {
  // coerceTypes: false, żeby liczba w polu tekstowym nie była cicho zamieniana na string.
  const app = Fastify({ logger: true, ajv: { customOptions: { coerceTypes: false } } });
  registerProblemHandling(app);
  registerBodyParsers(app);
  app.register(healthRoutes, { prefix: "/api" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(seriesRoutes, { prefix: "/api/series" });
  return app;
}