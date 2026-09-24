import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
export function openDatabase(path) {
  if (path !== ":memory:")
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS schema_version(version INTEGER NOT NULL);
 INSERT INTO schema_version SELECT 1 WHERE NOT EXISTS(SELECT 1 FROM schema_version);
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL,banned_until INTEGER NOT NULL DEFAULT 0,metadata TEXT NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
 CREATE TABLE IF NOT EXISTS profiles(account_id TEXT PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,schema_version INTEGER NOT NULL DEFAULT 1,saves TEXT NOT NULL DEFAULT '{}',achievements TEXT NOT NULL DEFAULT '[]',cosmetics TEXT NOT NULL DEFAULT '[]',statistics TEXT NOT NULL DEFAULT '{}');
 CREATE TABLE IF NOT EXISTS friendships(account_id TEXT REFERENCES accounts(id),friend_id TEXT REFERENCES accounts(id),status TEXT NOT NULL,PRIMARY KEY(account_id,friend_id));
 CREATE TABLE IF NOT EXISTS world_saves(id TEXT PRIMARY KEY,owner_id TEXT,schema_version INTEGER NOT NULL,saved_at INTEGER NOT NULL,state TEXT NOT NULL);`);
  if (path !== ":memory:") chmodSync(path, 0o600);
  return db;
}
