'use strict';
// 后端全链路冒烟测试（Node 22 全局 fetch）
const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (extra ? '  -> ' + JSON.stringify(extra) : '')); } }
async function j(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: r.status, data };
}

(async () => {
  console.log('— 健康检查 —');
  const h = await j('GET', '/api/health');
  ok('health ok', h.data.ok === true);

  console.log('— 配置：智能体 & 全局 —');
  const ag = await j('GET', '/api/config/agents');
  ok('7 智能体', Array.isArray(ag.data) && ag.data.length === 7, ag.data && ag.data.length);
  ok('含决策智能体', ag.data.some(a => a.key === 'decision'));
  ok('含 OCR 智能体', ag.data.some(a => a.key === 'ocr'));
  const gl = await j('GET', '/api/config/global');
  ok('全局阈值 0.80', gl.data.default_threshold === '0.80', gl.data);
  // 改一个智能体模型再改回
  const ua = await j('PUT', '/api/config/agents/ocr', { model: 'PaddleOCR v4（本地 GPU·改）' });
  ok('更新智能体模型', ua.data && ua.data.model.includes('改'));
  await j('PUT', '/api/config/agents/ocr', { model: 'PaddleOCR v4（本地 GPU）' });

  console.log('— 规则库 —');
  const rl = await j('GET', '/api/rules');
  ok('8 条规则', Array.isArray(rl.data) && rl.data.length === 8, rl.data && rl.data.length);
  const rc = await j('POST', '/api/rules', { level1: '文本校对', level2: '一致性', detail: '测试规则条目' });
  ok('创建规则 201', rc.status === 201 && rc.data.id);
  const rt = await j('POST', '/api/rules/' + rc.data.id + '/toggle');
  ok('规则启停切换', rt.data.status === '禁用', rt.data);
  await j('DELETE', '/api/rules/' + rc.data.id).catch(() => {}); // 规则无 DELETE，应 404

  console.log('— 知识库（三库分流） —');
  const kn = await j('GET', '/api/knowledge');
  ok('6 条知识', Array.isArray(kn.data) && kn.data.length === 6, kn.data && kn.data.length);
  ok('含 entity 库', kn.data.some(k => k.type === 'entity'));
  ok('含 badcase', kn.data.some(k => k.type === 'badcase'));
  const kc = await j('POST', '/api/knowledge', { type: 'rule', category: '合规规则', title: '测试知识' });
  ok('创建知识 201', kc.status === 201 && kc.data.id);
  const kd = await j('DELETE', '/api/knowledge/' + kc.data.id);
  ok('删除知识', kd.data && kd.data.ok === true);

  console.log('— 评测中心 —');
  const ev = await j('GET', '/api/evals');
  ok('4 条评测', Array.isArray(ev.data) && ev.data.length === 4, ev.data && ev.data.length);

  console.log('— 用户/角色/鉴权 —');
  const us = await j('GET', '/api/users');
  ok('3 用户', us.data.length === 3);
  const ro = await j('GET', '/api/roles');
  ok('3 角色', ro.data.length === 3);
  const lg = await j('POST', '/api/auth/login', { role: 'reviewer' });
  ok('登录 reviewer', lg.data && lg.data.role === 'reviewer');
  const lg2 = await j('POST', '/api/auth/login', { role: 'ghost' });
  ok('非法角色 401', lg2.status === 401);

  console.log('— 任务列表 & 详情（P000843 6 卡片） —');
  const tk = await j('GET', '/api/tasks');
  ok('5 个任务', Array.isArray(tk.data) && tk.data.length === 5, tk.data && tk.data.length);
  const d1 = await j('GET', '/api/tasks/P000843');
  ok('按任务号查 P000843', d1.data && d1.data.task_no === 'P000843');
  ok('P000843 含 6 卡片', d1.data.result.cards.length === 6, d1.data.result && d1.data.result.cards.length);
  ok('P000843 置信度 76', d1.data.result.confidence === 76, d1.data.result && d1.data.result.confidence);
  ok('P000843 转人工(handoff)', d1.data.handoff === 1 && d1.data.decision === 'handoff');
  const d2 = await j('GET', '/api/tasks/1');
  ok('按数字 id=1 查详情', d2.data && d2.data.id === 1);
  const d404 = await j('GET', '/api/tasks/999999');
  ok('不存在任务 404', d404.status === 404);

  console.log('— 工作台 —');
  const db = await j('GET', '/api/dashboard');
  ok('KPI 总数 5', db.data.kpis.total === 5, db.data.kpis);
  ok('含各智能体达标率', db.data.agentRates.length === 7);

  console.log('— 创建任务（触发 7 智能体流水线） —');
  const ct = await j('POST', '/api/tasks', { filename: '理财海报_测试.png', task_type: '图片审核', material_type: '宣传推介', creator: '李晓华' });
  ok('创建任务 201', ct.status === 201 && ct.data.task_no);
  ok('新任务含审核结果', ct.data.result && ct.data.result.cards.length > 0);
  const newNo = ct.data.task_no;
  // 陌生材料命中"保本"应转不通过
  const ct2 = await j('POST', '/api/tasks', { filename: '保本高收益海报.png', task_type: '图片审核' });
  ok('命中禁用词→reject', ct2.data.decision === 'reject', ct2.data.decision);
  ok('命中禁用词→置信度<80', ct2.data.result.confidence < 80, ct2.data.result && ct2.data.result.confidence);

  console.log('— 决策回流 & 重跑 —');
  const dec = await j('POST', '/api/tasks/' + newNo + '/decide', { action: 'pass', reason: '人工确认通过', reviewer: '王审核' });
  ok('决策 pass 回流', dec.data.task.review_status === '通过', dec.data.task && dec.data.task.review_status);
  ok('决策写入 decisions', dec.data.lastDecision && dec.data.lastDecision.action === 'pass');
  const re = await j('POST', '/api/tasks/' + newNo + '/rerun');
  ok('重跑返回结果', re.data && re.data.result && re.data.result.cards.length > 0);

  console.log('— 控制台 —');
  console.log(`\n结果：通过 ${pass} / 失败 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常', e); process.exit(2); });
