import { STATUS_CODES } from "node:http";
import type { FastifyError, FastifyInstance } from "fastify";
import { HttpProblem, type FieldError } from "../errors.js";

const ACCEPTED = new Set(["*/*", "application/*", "application/json", "application/problem+json"]);

function acceptsJson(header: string | undefined): boolean {
  if (!header) return true;
  return header.split(",").some((part) => {
    const [type, ...params] = part.trim().toLowerCase().split(";").map((s) => s.trim());
    const q = params.find((p) => p.startsWith("q="));
    if (q && Number(q.slice(2)) === 0) return false;
    return ACCEPTED.has(type ?? "");
  });
}

export function registerProblemHandling(app: FastifyInstance): void {
  // 406 sprawdzamy przed wszystkim innym, także przed autoryzacją.
  app.addHook("onRequest", async (req) => {
    if (!acceptsJson(req.headers.accept)) {
      throw new HttpProblem(406, "Not Acceptable", "Only application/json is supported");
    }
  });

  app.setNotFoundHandler((req, reply) => {
    reply.status(404).type("application/problem+json").send({
      type: "about:blank",
      title: "Not Found",
      status: 404,
      instance: req.url,
    });
  });

  app.setErrorHandler((err: FastifyError | HttpProblem, req, reply) => {
    let status = 500;
    let title = STATUS_CODES[500] ?? "Internal Server Error";
    let detail: string | undefined;
    let errors: FieldError[] | undefined;

    if (err instanceof HttpProblem) {
      ({ status, title, detail, errors } = err);
    } else if ("validation" in err && err.validation) {
      status = 400;
      title = "Bad Request";
      errors = err.validation.map((v) => ({
        field: v.instancePath.replace(/^\//, "") || String(v.params?.missingProperty ?? ""),
        message: v.message ?? "invalid",
      }));
    } else if (err.statusCode && err.statusCode < 500) {
      status = err.statusCode; // m.in. 400 niepoprawny JSON, 415 zły Content-Type
      title = STATUS_CODES[status] ?? "Error";
      detail = err.message;
    } else {
      req.log.error(err); // szczegółów 5xx nie ujawniamy klientowi
    }

    reply.status(status).type("application/problem+json").send({
      type: "about:blank",
      title,
      status,
      ...(detail && { detail }),
      ...(errors && { errors }),
      instance: req.url,
    });
  });
}