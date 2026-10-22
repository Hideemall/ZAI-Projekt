import type { FastifyPluginAsync } from "fastify";
import { pool } from "../db/pool.js";
import { HttpProblem } from "../errors.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { hashPassword, verifyPassword } from "../services/passwords.js";
import { issueToken, revokeOtherTokens, revokeToken } from "../services/tokens.js";

interface LoginBody {
  username: string;
  password: string;
}
interface PasswordBody {
  currentPassword: string;
  newPassword: string;
}

const loginSchema = {
  type: "object",
  required: ["username", "password"],
  properties: { username: { type: "string" }, password: { type: "string" } },
} as const;

const passwordSchema = {
  type: "object",
  required: ["currentPassword", "newPassword"],
  properties: { currentPassword: { type: "string" }, newPassword: { type: "string" } },
} as const;

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Body: LoginBody }>("/login", { schema: { body: loginSchema } }, async (req) => {
    const { username, password } = req.body;
    const { rows } = await pool.query<{ id: string; password_hash: string }>(
      "SELECT id, password_hash FROM admins WHERE username = $1",
      [username],
    );
    const admin = rows[0];
    if (!admin || !(await verifyPassword(admin.password_hash, password))) {
      throw new HttpProblem(401, "Unauthorized", "Invalid credentials");
    }
    return issueToken(admin.id);
  });

  app.post("/logout", { onRequest: requireAdmin }, async (req, reply) => {
    await revokeToken(req.admin!.tokenHash);
    return reply.code(204).send();
  });

  app.put<{ Body: PasswordBody }>(
    "/password",
    { onRequest: requireAdmin, schema: { body: passwordSchema } },
    async (req, reply) => {
      const { currentPassword, newPassword } = req.body;
      const { id, tokenHash } = req.admin!;

      if (newPassword.length < 8) {
        throw new HttpProblem(422, "Unprocessable Content", "Password too short", [
          { field: "newPassword", message: "must have at least 8 characters" },
        ]);
      }
      const { rows } = await pool.query<{ password_hash: string }>(
        "SELECT password_hash FROM admins WHERE id = $1",
        [id],
      );
      const current = rows[0];
      if (!current || !(await verifyPassword(current.password_hash, currentPassword))) {
        throw new HttpProblem(403, "Forbidden", "Current password is incorrect");
      }
      await pool.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [
        await hashPassword(newPassword),
        id,
      ]);
      await revokeOtherTokens(id, tokenHash);
      return reply.code(204).send();
    },
  );
};