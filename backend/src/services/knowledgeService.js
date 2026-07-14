'use strict';
/** 知识库 / 合规源 CRUD（PRD 知识工程：基金核心实体 / 合规规则 / 高频错误案例 三库分流）。 */
const { run, all, get } = require('../core/db');
function list({ type, category, keyword } = {}) {
  const where = [];
  const p = [];
  if (type) { where.push('type=?'); p.push(type); }
  if (category) { where.push('category=?'); p.push(category); }
  if (keyword) { where.push('(title LIKE ? OR content LIKE ?)'); p.push('%' + keyword + '%', '%' + keyword + '%'); }
  const sql = 'SELECT * FROM knowledge' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY id';
  return all(sql, p);
}
function create({ type, category, title, content, source, version, compliance_level, status }) {
  if (!title) return { error: 'title 必填' };
  const r = run(
    'INSERT INTO knowledge(type,category,title,content,source,version,compliance_level,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
    [type || 'faq', category || '', title, content || '', source || '', version || 'V1', compliance_level || 'low', status || '启用', new Date().toISOString().slice(0, 10)]);
  return get('SELECT * FROM knowledge WHERE id=?', [r.lastId]);
}
function update(id, patch = {}) {
  const cur = get('SELECT * FROM knowledge WHERE id=?', [id]);
  if (!cur) return null;
  const f = { ...cur, ...patch };
  run('UPDATE knowledge SET type=?,category=?,title=?,content=?,source=?,version=?,compliance_level=?,status=? WHERE id=?',
    [f.type, f.category, f.title, f.content, f.source, f.version, f.compliance_level, f.status, id]);
  return get('SELECT * FROM knowledge WHERE id=?', [id]);
}
function remove(id) {
  const cur = get('SELECT * FROM knowledge WHERE id=?', [id]);
  if (!cur) return null;
  run('DELETE FROM knowledge WHERE id=?', [id]);
  return cur;
}
module.exports = { list, create, update, remove };
