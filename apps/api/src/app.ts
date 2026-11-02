import Fastify, { type FastifyInstance } from "fastify";
import helmet from "@fastify/helmet";
import { registerBodyParsers } from "./middleware/bodyParsers.js";
import { registerProblemHandling } from "./middleware/problem.js";
import { authRoutes } from "./routes/auth.js";
import { healthRoutes } from "./routes/health.js";
import { seriesRoutes } from "./routes/series.js";
import { sensorRoutes } from "./routes/sensors.js";
import { measurementRoutes } from "./routes/measurements.js";

export function buildApp(): FastifyInstance {
  // coerceTypes: false, żeby liczba w polu tekstowym nie była cicho zamieniana na string.
  const app = Fastify({
    logger: true,
    trustProxy: true, // Render terminuje HTTPS na proxy
    ajv: { customOptions: { coerceTypes: false, allowUnionTypes: true } },
  });
  app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  registerProblemHandling(app);
  registerBodyParsers(app);
  app.register(healthRoutes, { prefix: "/api" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(seriesRoutes, { prefix: "/api/series" });
  app.register(sensorRoutes, { prefix: "/api/sensors" });
  app.register(measurementRoutes, { prefix: "/api/measurements" });
  return app;
}