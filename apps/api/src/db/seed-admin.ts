import { pool } from "./pool.js";
import { hashPassword } from "../services/passwords.js";

const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
if (!username || !password || password.length < 8) {
  throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD (min. 8 chars)");
}

try {
  // DO NOTHING: ponowny deploy nie nadpisuje hasła zmienionego przez admina.
  const res = await pool.query(
    "INSERT INTO admins (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING",
    [username, await hashPassword(password)],
  );
  console.log(res.rowCount ? `admin '${username}' created` : `admin '${username}' already exists`);
} finally {
  await pool.end();
}