import type { FastifyRequest } from "fastify";
import { pool } from "../db/pool.js";
import { HttpProblem } from "../errors.js";
import { sha256 } from "../services/crypto.js";

declare module "fastify" {
  interface FastifyRequest {
    admin?: { id: string; tokenHash: string };
  }
}

// Używać jako onRequest: 401 ma pierwszeństwo przed walidacją body.
export async function requireAdmin(req: FastifyRequest): Promise<void> {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!token) throw new HttpProblem(401, "Unauthorized", "Bearer token required");

  const tokenHash = sha256(token);
  const { rows } = await pool.query<{ admin_id: string }>(
    "SELECT admin_id FROM auth_tokens WHERE token_hash = $1 AND expires_at > now()",
    [tokenHash],
  );
  const row = rows[0];
  if (!row) throw new HttpProblem(401, "Unauthorized", "Invalid or expired token");
  req.admin = { id: row.admin_id, tokenHash };
}