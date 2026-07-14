'use strict';
/** 审核规则库 CRUD + 启停切换，对应「规则库」页。 */
const { run, all, get } = require('../core/db');
function list({ level1, keyword } = {}) {
  const where = [];
  const p = [];
  if (level1) { where.push('level1=?'); p.push(level1); }
  if (keyword) { where.push('(detail LIKE ? OR level2 LIKE ?)'); p.push('%' + keyword + '%', '%' + keyword + '%'); }
  const sql = 'SELECT * FROM rules' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY id';
  return all(sql, p);
}
function create({ level1, level2, detail, material_type, status }) {
  if (!detail) return { error: 'detail 必填' };
  const r = run(
    'INSERT INTO rules(level1,level2,detail,material_type,status,hit_count,version,created_at) VALUES(?,?,?,?,?,?,?,?)',
    [level1 || '文本校对', level2 || '', detail, material_type || '全部类型', status || '启用', 0, 'V3', new Date().toISOString().slice(0, 10)]);
  return get('SELECT * FROM rules WHERE id=?', [r.lastId]);
}
function update(id, patch = {}) {
  const cur = get('SELECT * FROM rules WHERE id=?', [id]);
  if (!cur) return null;
  const f = { ...cur, ...patch };
  run('UPDATE rules SET level1=?,level2=?,detail=?,material_type=?,status=? WHERE id=?',
    [f.level1, f.level2, f.detail, f.material_type, f.status, id]);
  return get('SELECT * FROM rules WHERE id=?', [id]);
}
function toggle(id) {
  const cur = get('SELECT * FROM rules WHERE id=?', [id]);
  if (!cur) return null;
  const next = cur.status === '启用' ? '禁用' : '启用';
  run('UPDATE rules SET status=? WHERE id=?', [next, id]);
  return get('SELECT * FROM rules WHERE id=?', [id]);
}
module.exports = { list, create, update, toggle };
