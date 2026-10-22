import { randomBytes } from "node:crypto";
import { pool } from "../db/pool.js";
import { sha256 } from "./crypto.js";

const TTL_SECONDS = 3600;

export interface LoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export async function issueToken(adminId: string): Promise<LoginResponse> {
  await pool.query("DELETE FROM auth_tokens WHERE expires_at < now()");
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    "INSERT INTO auth_tokens (token_hash, admin_id, expires_at) VALUES ($1, $2, now() + make_interval(secs => $3))",
    [sha256(token), adminId, TTL_SECONDS],
  );
  return { accessToken: token, tokenType: "Bearer", expiresIn: TTL_SECONDS };
}

export const revokeToken = (tokenHash: string): Promise<unknown> =>
  pool.query("DELETE FROM auth_tokens WHERE token_hash = $1", [tokenHash]);

// Po zmianie hasła unieważniamy pozostałe sesje tego admina.
export const revokeOtherTokens = (adminId: string, keepHash: string): Promise<unknown> =>
  pool.query("DELETE FROM auth_tokens WHERE admin_id = $1 AND token_hash <> $2", [adminId, keepHash]);