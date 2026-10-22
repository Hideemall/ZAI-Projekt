import type { FastifyInstance } from "fastify";
import sjson from "secure-json-parse";
import { HttpProblem } from "../errors.js";

// Puste body jest dozwolone (np. POST /auth/logout); niepuste nie-JSON => 415.
export function registerBodyParsers(app: FastifyInstance): void {
    app.removeAllContentTypeParsers();
    app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body, done) => {
        if (body === "") return done(null, undefined);
        try {
        done(null, sjson.parse(body as string, undefined, { protoAction: "error", constructorAction: "error" }));
        } catch {
        done(new HttpProblem(400, "Bad Request", "Malformed JSON body"));
        }
    });

    app.addContentTypeParser("*", { parseAs: "buffer" }, (_req, body, done) => {
        if ((body as Buffer).length === 0) return done(null, undefined);
        done(new HttpProblem(415, "Unsupported Media Type", "Only application/json is supported"));
    });
}