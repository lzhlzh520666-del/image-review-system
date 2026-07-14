'use strict';
/** 模型与智能体配置：7 智能体逐体配置读写 + 全局兜底/阈值。 */
const { run, all, get } = require('../core/db');
function listAgents() { return all('SELECT * FROM agents ORDER BY order_idx'); }
function updateAgent(key, patch = {}) {
  const cur = get('SELECT * FROM agents WHERE key=?', [key]);
  if (!cur) return null;
  const f = { ...cur, ...patch };
  run('UPDATE agents SET model=?,thinking=?,threshold=?,enabled=?,role_desc=? WHERE key=?',
    [f.model, f.thinking ? 1 : 0, f.threshold, f.enabled ? 1 : 0, f.role_desc, key]);
  return get('SELECT * FROM agents WHERE key=?', [key]);
}
function getGlobal() {
  const rows = all('SELECT key,value FROM config_kv');
  const o = {};
  rows.forEach((r) => { o[r.key] = r.value; });
  return o;
}
function setGlobal(patch = {}) {
  Object.entries(patch).forEach(([k, v]) => {
    const ex = get('SELECT * FROM config_kv WHERE key=?', [k]);
    if (ex) run('UPDATE config_kv SET value=? WHERE key=?', [String(v), k]);
    else run('INSERT INTO config_kv(key,value) VALUES(?,?)', [k, String(v)]);
  });
  return getGlobal();
}
module.exports = { listAgents, updateAgent, getGlobal, setGlobal };
