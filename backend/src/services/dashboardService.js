'use strict';
/** 工作台：4 KPI + 7 日趋势 + 结论分布 + 各智能体达标率。 */
const { all } = require('../core/db');
function dashboard() {
  const tasks = all('SELECT * FROM tasks');
  const total = tasks.length;
  const pass = tasks.filter((t) => t.review_status === '通过').length;
  const reject = tasks.filter((t) => t.review_status === '不通过').length;
  const handoff = tasks.filter((t) => t.review_status === '待人工复核').length;
  const avgConf = total ? Math.round(tasks.reduce((s, t) => s + (t.confidence || 0), 0) / total) : 0;

  const byDay = {};
  tasks.forEach((t) => {
    const d = (t.created_at || '').slice(0, 10);
    if (d) byDay[d] = (byDay[d] || 0) + 1;
  });
  const trend = Object.keys(byDay).sort().slice(-7).map((d) => ({ date: d, count: byDay[d] }));

  const conclusionDist = { pass, reject, handoff };

  const agents = all('SELECT * FROM agents ORDER BY order_idx');
  const evals = all('SELECT * FROM evals');
  // 各智能体可达达标率：取评测中最优模型对应指标（启发式映射）
  const metricOf = { ocr: 'ocr_acc', multimodal: 'multimodal_acc', entity: 'entity_f1', validate: 'compliance_acc', rule: 'compliance_acc', parse: 'multimodal_acc', decision: 'compliance_acc' };
  const agentRates = agents.map((a) => {
    const metric = metricOf[a.key] || 'accuracy';
    const best = evals.reduce((b, e) => ((e[metric] || 0) > (b ? b[metric] : 0) ? e : b), null);
    return { key: a.key, name: a.name, target: a.threshold, rate: best ? best[metric] : null, model: best ? best.model : null };
  });

  return { kpis: { total, pass, reject, handoff, avgConf }, conclusionDist, trend, agentRates };
}
module.exports = { dashboard };
