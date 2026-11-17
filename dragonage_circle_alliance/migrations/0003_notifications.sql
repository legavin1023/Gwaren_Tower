CREATE TABLE notifications(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),event_key TEXT NOT NULL,kind TEXT NOT NULL,reasons TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,url TEXT NOT NULL,created_at TEXT NOT NULL,read_at TEXT,UNIQUE(member_id,event_key));
CREATE INDEX idx_notifications_member ON notifications(member_id,created_at DESC);
CREATE TABLE push_subscriptions(endpoint TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),session_hash TEXT NOT NULL,subscription TEXT NOT NULL,preferences TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE INDEX idx_push_member ON push_subscriptions(member_id);
