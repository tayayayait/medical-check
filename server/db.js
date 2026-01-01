import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_FORBIDDEN_PHRASES } from './legalReferences.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

export const initDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL,
      mimeType TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS analysis_results (
      id TEXT PRIMARY KEY,
      adName TEXT,
      createdAt TEXT,
      passScore REAL,
      riskLevel TEXT,
      analysisSource TEXT,
      aiError TEXT,
      status TEXT,
      imageFileId TEXT,
      ocrFullText TEXT,
      ocrBoxesJson TEXT,
      aiRationale TEXT,
      findingsJson TEXT,
      referencesJson TEXT
    );

    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id TEXT PRIMARY KEY,
      status TEXT,
      resultId TEXT,
      error TEXT,
      requestedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS forbidden_phrases (
      id TEXT PRIMARY KEY,
      phrase TEXT,
      riskLevel TEXT,
      violationType TEXT,
      referenceId TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      role TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auditLog INTEGER,
      retention TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT,
      actor TEXT,
      createdAt TEXT
    );
  `);

  const settings = db.prepare('SELECT COUNT(*) as count FROM system_settings').get();
  if (settings.count === 0) {
    db.prepare('INSERT INTO system_settings (id, auditLog, retention) VALUES (1, ?, ?)').run(1, '180d');
  }

  const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (users.count === 0) {
    db.prepare('INSERT INTO users (id, email, role, status) VALUES (?, ?, ?, ?)').run('U-001', 'admin@medai.com', 'admin', 'active');
    db.prepare('INSERT INTO users (id, email, role, status) VALUES (?, ?, ?, ?)').run('U-002', 'reviewer@medai.com', 'reviewer', 'active');
  }

  try {
    db.exec('ALTER TABLE analysis_results ADD COLUMN ocrBoxesJson TEXT');
  } catch (error) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE analysis_results ADD COLUMN analysisSource TEXT');
  } catch (error) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE analysis_results ADD COLUMN aiError TEXT');
  } catch (error) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE forbidden_phrases ADD COLUMN violationType TEXT');
  } catch (error) {
    // Column already exists
  }

  try {
    db.exec('ALTER TABLE forbidden_phrases ADD COLUMN referenceId TEXT');
  } catch (error) {
    // Column already exists
  }

  const forbidden = db.prepare('SELECT COUNT(*) as count FROM forbidden_phrases').get();
  if (forbidden.count === 0) {
    const insert = db.prepare(`
      INSERT INTO forbidden_phrases (id, phrase, riskLevel, violationType, referenceId, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    DEFAULT_FORBIDDEN_PHRASES.forEach((item, index) => {
      const id = `FP-${String(index + 1).padStart(3, '0')}`;
      insert.run(id, item.phrase, item.riskLevel, item.violationType, item.referenceId, new Date().toISOString());
    });
  }

  DEFAULT_FORBIDDEN_PHRASES.forEach((item) => {
    db.prepare(`
      UPDATE forbidden_phrases
      SET violationType = COALESCE(violationType, ?),
          referenceId = COALESCE(referenceId, ?)
      WHERE phrase = ?
    `).run(item.violationType, item.referenceId, item.phrase);
  });
};

export const insertAuditLog = (action, actor) => {
  const id = `LOG-${Date.now()}`;
  db.prepare('INSERT INTO audit_logs (id, action, actor, createdAt) VALUES (?, ?, ?, ?)').run(id, action, actor, new Date().toISOString());
};
