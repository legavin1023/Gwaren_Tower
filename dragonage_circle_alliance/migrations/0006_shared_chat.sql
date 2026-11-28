-- One shared room; presence and typing are intentionally not persisted here.
CREATE TABLE chat_messages (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 member_id TEXT NOT NULL REFERENCES members(id),
 client_message_id TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
 created_at TEXT NOT NULL,
 UNIQUE(member_id, client_message_id)
);
