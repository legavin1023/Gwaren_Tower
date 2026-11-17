ALTER TABLE members ADD COLUMN representative_character_id TEXT REFERENCES characters(id);
