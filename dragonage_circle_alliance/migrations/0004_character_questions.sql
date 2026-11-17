CREATE TABLE questions (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL REFERENCES members(id),
 character_id TEXT NOT NULL REFERENCES characters(id),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 2000),
 answer TEXT NOT NULL DEFAULT '' CHECK(length(answer)<=20000),
 answered_by TEXT REFERENCES members(id),
 answered_at TEXT,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 deleted_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_questions_character ON questions(character_id,deleted_at,created_at);
