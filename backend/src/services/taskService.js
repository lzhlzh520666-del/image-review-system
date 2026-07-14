'use strict';
/**
 * 审核任务服务 + 7 智能体审核流水线（模拟串联）。
 *
 * 流水线：OCR → 多模态解析 → 实体识别 → 数据校验 → 文本规则审核 → 错点解析 → 决策智能体
 * 当前为「确定性模拟」：已知海报复现原型 6 卡片；陌生材料走关键词启发式。
 * 接入真实模型时，仅需把 runPipeline 内各 step 替换为对应智能体的 HTTP/gRPC 调用，
 * 保持返回结构不变即可（见 RESULT_P000843 形状）。
 */
const { run, all, get } = require('../core/db');
const { RESULT_P000843 } = require('../config/seed');

const p2 = (n) => String(n).padStart(2, '0');
function nowTs() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/* ---------- 流水线辅助 ---------- */
function mkBox(id, anno, top, tag, kind) {
  return { id, anno, top, left: '2%', width: '96%', height: '12%', tag, kind };
}
function mkCard(idx, anno, group, status, desc, reason = '', reasonType = '', time = '') {
  const tag = status === 'pass' ? 'num-correct' : status === 'fail' ? (group === '合规规则' ? 'num-rule' : 'num-ai') : 'num-ai';
  const label = status === 'pass' ? '[正确]' : status === 'fail' ? (group === '合规规则' ? '[合规规则]' : '[AI标]') : '[AI标]';
  return { idx: '#' + idx, anno, group, status, tag, label, desc, reason, reasonType, time };
}
function randTop(i) { return (8 + i * 13) + '%'; }

/**
 * 运行 7 智能体流水线。
 * @returns {anno_boxes, cards, confidence, conclusion, ocr_text, agent_outputs, review_status, decision, handoff}
 */
function runPipeline({ filename, task_type }) {
  // ① 已知材料：复现原型中的 6 卡片审核结果
  if (/易方达安瑞|安瑞短债|宣传海报|定投海报/.test(filename || '')) {
    const r = JSON.parse(JSON.stringify(RESULT_P000843));
    return {
      anno_boxes: r.anno_boxes, cards: r.cards, confidence: r.confidence,
      conclusion: r.conclusion, ocr_text: r.ocr_text, agent_outputs: r.agent_outputs,
      review_status: '待人工复核', decision: 'handoff', handoff: 1
    };
  }

  // ② 陌生材料：启发式（模拟各智能体输出）
  const lower = (filename || '').toLowerCase();
  let idx = 0;
  const boxes = [];
  const cards = [];

  // 文本校对：基金代码/名称一致性（默认通过）
  idx++;
  cards.push(mkCard(idx, 1, '文本校对', 'pass', '基金代码/名称与备案信息一致性校验通过 ✓'));
  boxes.push(mkBox('box' + boxes.length, 1, randTop(boxes.length), '基金基本信息', 'warn'));

  // 合规规则命中（依据禁用词/收益承诺关键词）
  const HIT_RULES = [
    { kw: ['稳赚', '保本', '零风险', '业绩突出', 'guaranteed'], rule: '禁止使用"稳赚""保本""零风险"等词汇', tag: '禁用词命中' },
    { kw: ['业绩', '收益'], rule: '展示历史业绩数据时必须在同一视觉区域附带风险提示文字', tag: '业绩展示' }
  ];
  HIT_RULES.forEach((h) => {
    if (h.kw.some((k) => lower.includes(k.toLowerCase()))) {
      idx++;
      cards.push(mkCard(idx, 5, '合规规则', 'fail', '命中合规规则：' + h.rule, '命中规则：' + h.rule, 'fail', nowTs()));
      boxes.push(mkBox('box' + boxes.length, 5, randTop(boxes.length), h.tag, 'danger'));
    }
  });

  // 指标校对：默认通过
  idx++;
  cards.push(mkCard(idx, 4, '指标校对', 'pass', '指标数据校验通过，数值在允许范围内 ✓'));
  boxes.push(mkBox('box' + boxes.length, 4, randTop(boxes.length), '指标数据', 'warn'));

  const failCount = cards.filter((c) => c.status === 'fail').length;
  const confidence = Math.max(40, 96 - failCount * 18 + (boxes.length % 3) - 1);
  // PRD 6.1：置信度 < 80% 自动转人工复核
  const handoff = confidence < 80 ? 1 : 0;
  const conclusion = failCount > 0 ? '不通过' : (handoff ? '待人工复核' : '通过');
  const decision = failCount > 0 ? 'reject' : (handoff ? 'handoff' : 'pass');
  const agent_outputs = {
    ocr: 0.99, multimodal: 0.95, entity: 0.96, validate: 0.93,
    rule: failCount > 0 ? 0.85 : 0.92, parse: 0.90, decision: +(confidence / 100).toFixed(2)
  };

  return {
    anno_boxes: boxes, cards, confidence, conclusion,
    ocr_text: (filename || 'material') + ' 的模拟识别文本（BASE64 图片未在后端解码，仅按文件名启发式模拟）',
    agent_outputs, review_status: conclusion, decision, handoff
  };
}

function nextTaskNo() {
  const rows = all('SELECT task_no FROM tasks');
  let max = 843;
  rows.forEach((r) => { const m = /P(\d+)/.exec(r.task_no); if (m) max = Math.max(max, +m[1]); });
  return 'P' + (max + 1);
}

/* ---------- 任务 CRUD + 流水线触发 ---------- */
function list({ status, task_type, keyword } = {}) {
  const where = [];
  const p = [];
  if (status) { where.push('review_status=? OR status=?'); p.push(status, status); }
  if (task_type) { where.push('task_type=?'); p.push(task_type); }
  if (keyword) { where.push('filename LIKE ?'); p.push('%' + keyword + '%'); }
  const sql = 'SELECT * FROM tasks' + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY id DESC';
  return all(sql, p);
}

function findTask(idOrNo) {
  return /^\d+$/.test(String(idOrNo))
    ? get('SELECT * FROM tasks WHERE id=?', [+idOrNo])
    : get('SELECT * FROM tasks WHERE task_no=?', [idOrNo]);
}

function detail(idOrNo) {
  const task = findTask(idOrNo);
  if (!task) return null;
  const res = get('SELECT * FROM review_results WHERE task_id=?', [task.id]);
  return {
    ...task,
    result: res ? {
      anno_boxes: JSON.parse(res.anno_boxes_json || '[]'),
      cards: JSON.parse(res.cards_json || '[]'),
      confidence: res.confidence,
      conclusion: res.conclusion,
      ocr_text: res.ocr_text,
      agent_outputs: JSON.parse(res.agent_outputs_json || '{}')
    } : null
  };
}

function create({ filename, task_type, material_type, creator }) {
  if (!filename) return { error: 'filename 必填' };
  const task_no = nextTaskNo();
  const ins = run(
    'INSERT INTO tasks(task_no,filename,task_type,material_type,status,review_status,creator,created_at,confidence,decision,handoff) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    [task_no, filename, task_type || '图片审核', material_type || '宣传推介', '审核中', '待人工复核', creator || '李晓华', nowTs(), 0, 'handoff', 1]);
  const taskId = ins.lastId;
  const r = runPipeline({ filename, task_type: task_type || '图片审核' });
  run(
    'INSERT INTO review_results(task_id,anno_boxes_json,cards_json,confidence,conclusion,ocr_text,agent_outputs_json) VALUES(?,?,?,?,?,?,?)',
    [taskId, JSON.stringify(r.anno_boxes), JSON.stringify(r.cards), r.confidence, r.conclusion, r.ocr_text, JSON.stringify(r.agent_outputs)]);
  run('UPDATE tasks SET status=?,review_status=?,confidence=?,decision=?,handoff=? WHERE id=?',
    ['审核成功', r.review_status, r.confidence, r.decision, r.handoff, taskId]);
  return detail(taskId);
}

function decide(taskId, { action, reason, reviewer }) {
  if (!['pass', 'reject', 'handoff'].includes(action)) return { error: 'action 必须是 pass/reject/handoff' };
  const task = findTask(taskId);
  if (!task) return null;
  run('INSERT INTO decisions(task_id,action,reason,reviewer,created_at) VALUES(?,?,?,?,?)',
    [task.id, action, reason || '', reviewer || '王审核', nowTs()]);
  const map = { pass: '通过', reject: '不通过', handoff: '待人工复核' };
  run('UPDATE tasks SET decision=?,decision_reason=?,review_status=?,status=? WHERE id=?',
    [action, reason || '', map[action], '审核成功', task.id]);
  return { task: get('SELECT * FROM tasks WHERE id=?', [task.id]), lastDecision: get('SELECT * FROM decisions WHERE task_id=? ORDER BY id DESC LIMIT 1', [task.id]) };
}

function rerun(taskId) {
  const task = findTask(taskId);
  if (!task) return null;
  const r = runPipeline({ filename: task.filename, task_type: task.task_type });
  const exist = get('SELECT * FROM review_results WHERE task_id=?', [task.id]);
  if (exist) {
    run('UPDATE review_results SET anno_boxes_json=?,cards_json=?,confidence=?,conclusion=?,ocr_text=?,agent_outputs_json=? WHERE task_id=?',
      [JSON.stringify(r.anno_boxes), JSON.stringify(r.cards), r.confidence, r.conclusion, r.ocr_text, JSON.stringify(r.agent_outputs), task.id]);
  } else {
    run('INSERT INTO review_results(task_id,anno_boxes_json,cards_json,confidence,conclusion,ocr_text,agent_outputs_json) VALUES(?,?,?,?,?,?)',
      [task.id, JSON.stringify(r.anno_boxes), JSON.stringify(r.cards), r.confidence, r.conclusion, r.ocr_text, JSON.stringify(r.agent_outputs)]);
  }
  run('UPDATE tasks SET review_status=?,confidence=?,decision=?,handoff=? WHERE id=?',
    [r.review_status, r.confidence, r.decision, r.handoff, task.id]);
  return detail(taskId);
}

module.exports = { list, detail, create, decide, rerun, runPipeline, findTask };
