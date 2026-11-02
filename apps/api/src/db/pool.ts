import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

export const pool = new pg.Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000, // zapas na wybudzenie bazy po scale-to-zero
});

// Baza może zerwać bezczynne połączenie; bez handlera zdarzenie 'error' wywróciłoby proces.
pool.on("error", (err) => console.error("idle pg client error:", err.message));