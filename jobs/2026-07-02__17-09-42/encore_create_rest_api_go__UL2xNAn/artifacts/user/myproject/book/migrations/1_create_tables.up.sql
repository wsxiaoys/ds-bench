CREATE TABLE IF NOT EXISTS books (
    id      BIGSERIAL PRIMARY KEY,
    title   TEXT NOT NULL,
    author  TEXT NOT NULL
);
