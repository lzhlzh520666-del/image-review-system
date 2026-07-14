'use strict';
/**
 * 轻量数据库层：基于 Node 22 内置 node:sqlite（零依赖）。
 * 生产环境（PRD 3.4）建议切 MySQL + MongoDB + Milvus；本 MVP 用单文件 SQLite 保证「node server.js」一键跑通，
 * 后续换库仅需改本文件，业务层不动。
 */
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'ai_review.db');

let _db;
function getDb() {
  if (!_db) _db = new DatabaseSync(DB_PATH);
  return _db;
}

function initSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_no TEXT, filename TEXT, task_type TEXT, material_type TEXT,
      status TEXT, review_status TEXT, creator TEXT, created_at TEXT,
      confidence REAL, decision TEXT, decision_reason TEXT, handoff INTEGER,
      image_path TEXT
    );
    CREATE TABLE IF NOT EXISTS review_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER, anno_boxes_json TEXT, cards_json TEXT,
      confidence REAL, conclusion TEXT, ocr_text TEXT, agent_outputs_json TEXT,
      mock INTEGER
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER, action TEXT, reason TEXT, reviewer TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level1 TEXT, level2 TEXT, detail TEXT, material_type TEXT,
      status TEXT, hit_count INTEGER, version TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT, name TEXT, model TEXT, thinking INTEGER,
      threshold REAL, enabled INTEGER, role_desc TEXT, compliance_sensitive INTEGER, order_idx INTEGER
    );
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT, name TEXT, description TEXT, member_count INTEGER
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT, name TEXT, role TEXT, dept TEXT, status TEXT, last_active TEXT
    );
    CREATE TABLE IF NOT EXISTS knowledge (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT, category TEXT, title TEXT, content TEXT,
      source TEXT, version TEXT, compliance_level TEXT, status TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS evals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model TEXT, ocr_acc REAL, multimodal_acc REAL, entity_f1 REAL,
      compliance_acc REAL, latency INTEGER, dataset TEXT, accuracy REAL, note TEXT, kind TEXT
    );
    CREATE TABLE IF NOT EXISTS config_kv (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE, value TEXT
    );
  `);
}

function get(sql, params = []) { return getDb().prepare(sql).get(...params); }
function all(sql, params = []) { return getDb().prepare(sql).all(...params); }
function run(sql, params = []) {
  const stmt = getDb().prepare(sql);
  stmt.run(...params);
  // node:sqlite 的 Statement 不暴露 lastInsertRowid，统一用 last_insert_rowid()
  const id = get('SELECT last_insert_rowid() AS id').id;
  return { lastId: id, changes: stmt.changes };
}
function reset() {
  const db = getDb();
  // 用 DROP 而非 DELETE：确保 --force 重新播种时按「当前 schema」重建表，
  // 否则旧表缺列（如后来加的 image_path / mock）会导致 INSERT 失败。
  ['tasks', 'review_results', 'decisions', 'rules', 'agents', 'roles', 'users', 'knowledge', 'evals', 'config_kv']
    .forEach((t) => { try { db.exec(`DROP TABLE IF EXISTS ${t}`); } catch (e) {} });
}

module.exports = { initSchema, get, all, run, reset, getDb };
