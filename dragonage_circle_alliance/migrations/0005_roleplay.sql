CREATE TABLE rp_scenes (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES members(id),
 title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', location TEXT NOT NULL DEFAULT '',
 visibility TEXT NOT NULL DEFAULT 'members' CHECK(visibility IN ('members','participants')),
 join_policy TEXT NOT NULL DEFAULT 'open' CHECK(join_policy IN ('open','invite')),
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','ended','archived')),
 participant_ids TEXT NOT NULL DEFAULT '[]', member_ids TEXT NOT NULL DEFAULT '[]', admin_ids TEXT NOT NULL DEFAULT '[]', image_path TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE rp_messages (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES members(id), character_id TEXT REFERENCES characters(id),
 scene_id TEXT REFERENCES rp_scenes(id), parent_id TEXT REFERENCES rp_messages(id), thread_id TEXT NOT NULL REFERENCES rp_messages(id) DEFERRABLE INITIALLY DEFERRED,
 author_name TEXT NOT NULL, faction TEXT, body TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]', request_id TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, revision INTEGER NOT NULL DEFAULT 1,UNIQUE(owner_id,request_id)
);
CREATE TABLE rp_assets(path TEXT PRIMARY KEY REFERENCES uploads(path),owner_id TEXT NOT NULL REFERENCES members(id),scene_id TEXT REFERENCES rp_scenes(id),created_at TEXT NOT NULL);
CREATE TABLE rp_changes(id INTEGER PRIMARY KEY AUTOINCREMENT, record_type TEXT NOT NULL,record_id TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX idx_rp_messages_scene ON rp_messages(scene_id,created_at);
CREATE INDEX idx_rp_messages_thread ON rp_messages(thread_id,created_at);
CREATE INDEX idx_rp_messages_character ON rp_messages(character_id,created_at);
CREATE INDEX idx_rp_changes_record ON rp_changes(record_type,record_id,id);
CREATE TABLE rp_preferences(id TEXT PRIMARY KEY REFERENCES members(id),mode TEXT NOT NULL DEFAULT 'all' CHECK(mode IN ('all','replies','mentions','off')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE rp_reads(id TEXT PRIMARY KEY,member_id TEXT NOT NULL REFERENCES members(id),scope TEXT NOT NULL,message_id TEXT REFERENCES rp_messages(id),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(member_id,scope));
