'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function openDatabase({ dataDir }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'protangram.sqlite');
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');

  const migrationDir = path.join(__dirname, 'migrations');
  const migrations = fs.readdirSync(migrationDir).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const name of migrations) {
    const version = Number(name.match(/^(\d+)/)[1]);
    const alreadyApplied = db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version);
    if (alreadyApplied) continue;
    const sql = fs.readFileSync(path.join(migrationDir, name), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      db.close();
      throw new Error('Database migration failed (' + name + '): ' + error.message, { cause: error });
    }
  }

  return { db, dbPath, dataDir, assetDir: path.join(dataDir, 'assets') };
}

module.exports = { openDatabase };
