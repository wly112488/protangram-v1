'use strict';

const fs = require('node:fs');
const path = require('node:path');

function importJsonDirectoryOnce({ db, resourceType, directory, importRecord }) {
  const previous = db.prepare('SELECT * FROM legacy_import_batches WHERE resource_type = ?').get(resourceType);
  if (previous) return { skipped: true, filesImported: previous.files_imported };

  fs.mkdirSync(directory, { recursive: true });
  const files = fs.readdirSync(directory).filter(name => name.toLowerCase().endsWith('.json')).sort();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const filename of files) {
      const fullPath = path.join(directory, filename);
      if (!fs.statSync(fullPath).isFile()) continue;
      let payload;
      try { payload = JSON.parse(fs.readFileSync(fullPath, 'utf8')); }
      catch (error) { throw new Error('旧数据迁移失败，JSON 无法解析: ' + fullPath + ' (' + error.message + ')'); }
      importRecord(payload, filename);
    }
    db.prepare('INSERT INTO legacy_import_batches(resource_type, imported_at, files_imported, source_dir) VALUES (?, ?, ?, ?)')
      .run(resourceType, new Date().toISOString(), files.length, directory);
    db.exec('COMMIT');
    return { skipped: false, filesImported: files.length };
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

module.exports = { importJsonDirectoryOnce };
