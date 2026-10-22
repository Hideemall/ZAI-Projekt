CREATE TABLE admins (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tokeny nieprzezroczyste: w bazie tylko SHA-256, logout = usunięcie wiersza.
CREATE TABLE auth_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  admin_id   BIGINT NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_expires_idx ON auth_tokens (expires_at);

CREATE TABLE series (
  id        BIGSERIAL PRIMARY KEY,
  name      VARCHAR(100) NOT NULL CHECK (char_length(name) >= 1),
  min_value DOUBLE PRECISION NOT NULL,
  max_value DOUBLE PRECISION NOT NULL,
  color     CHAR(7) NOT NULL CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon      TEXT,
  unit      VARCHAR(20),
  CONSTRAINT series_min_lt_max CHECK (min_value < max_value)
);

CREATE TABLE sensors (
  id           BIGSERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL CHECK (char_length(name) >= 1),
  series_id    BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  api_key_hash CHAR(64) NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sensors_series_idx ON sensors (series_id);

CREATE TABLE measurements (
  id         BIGSERIAL PRIMARY KEY,
  series_id  BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  sensor_id  BIGINT REFERENCES sensors(id) ON DELETE SET NULL,
  value      DOUBLE PRECISION NOT NULL,
  timestamp  TIMESTAMPTZ NOT NULL
);
CREATE INDEX measurements_series_ts_idx ON measurements (series_id, timestamp);
CREATE INDEX measurements_ts_idx ON measurements (timestamp);

-- F4: log odrzuconych pomiarów (wartość spoza zakresu, timestamp z przyszłości).
CREATE TABLE validation_log (
  id         BIGSERIAL PRIMARY KEY,
  series_id  BIGINT REFERENCES series(id) ON DELETE CASCADE,
  sensor_id  BIGINT REFERENCES sensors(id) ON DELETE SET NULL,
  value      DOUBLE PRECISION,
  timestamp  TIMESTAMPTZ,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX validation_log_created_idx ON validation_log (created_at DESC);