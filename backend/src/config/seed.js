'use strict';
/**
 * 种子数据 —— 严格对齐正确 PRD（《AI 智能图片审核系统 PRD》docx + wiki 面试稿）。
 * 7 智能体 / 8 条规则 / 三角色用户 / 审核任务(含 P000843 完整 6 卡片审核结果) / 知识库三库 / 评测。
 * 运行：node src/config/seed.js        (仅当表为空时播种)
 *      node src/config/seed.js --force  (清空后重建)
 */
const db = require('../core/db');
const { run, get, all, reset } = db;

const p2 = (n) => String(n).padStart(2, '0');
function ts(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

/* ============== 7 智能体（逐体模型配置，对应「模型与阈值配置」页） ============== */
// 名称/模型严格对齐 PRD 3.3 智能体职责表 + 4.2 V1 阶段选型（推荐 Qwen-Max 系列）
const AGENTS = [
  { key: 'ocr',        name: 'OCR 智能体',        model: 'PaddleOCR v4（本地 GPU）',            thinking: 0, threshold: 0.90, enabled: 1, role_desc: '图片文字识别，输出结构化文本',                    compliance_sensitive: 0, order_idx: 1 },
  { key: 'multimodal', name: '多模态解析智能体',  model: 'Qwen-VL-Max（云端 API）',             thinking: 0, threshold: 0.88, enabled: 1, role_desc: '图文关系理解、图表解析，输出图文对应文本',  compliance_sensitive: 0, order_idx: 2 },
  { key: 'entity',     name: '实体识别智能体',    model: 'BERT-NER / Qwen-Max（云端 API）',    thinking: 0, threshold: 0.85, enabled: 1, role_desc: '抽取基金代码/名称/日期等实体及属性',        compliance_sensitive: 0, order_idx: 3 },
  { key: 'validate',   name: '数据校验智能体',    model: '规则引擎 + 知识图谱',                 thinking: 0, threshold: 0.82, enabled: 1, role_desc: '数据一致性校验（如基金代码 vs 名称）',      compliance_sensitive: 0, order_idx: 4 },
  { key: 'rule',       name: '文本规则审核智能体',model: 'Qwen-Max + RAG 规则库',              thinking: 1, threshold: 0.80, enabled: 1, role_desc: '合规规则匹配（禁用词、敏感词）',              compliance_sensitive: 1, order_idx: 5 },
  { key: 'parse',      name: '错点解析智能体',    model: 'CV 定位 + 文本对齐',                 thinking: 0, threshold: 0.80, enabled: 1, role_desc: '错误定位与标注，输出错误坐标及说明',        compliance_sensitive: 0, order_idx: 6 },
  { key: 'decision',   name: '决策智能体',        model: '集成学习模型（Qwen-Max）',           thinking: 0, threshold: 0.80, enabled: 1, role_desc: '综合判断、风险评分、人工介入决策',            compliance_sensitive: 1, order_idx: 7 }
];

/* ============== 审核规则库（8 条，对应「规则库」页） ============== */
const RULES = [
  { level1: '合规规则', level2: '信息披露', detail: '基金成立不满 6 个月不得展示业绩数据', material_type: '宣传推介/营销材料', status: '启用', hit_count: 3, version: 'V3' },
  { level1: '合规规则', level2: '风险提示', detail: '必须包含法定风险揭示语句且字号≥10px', material_type: '全部类型', status: '启用', hit_count: 12, version: 'V3' },
  { level1: '合规规则', level2: '收益承诺', detail: '禁止使用具体收益率区间或保本表述', material_type: '全部类型', status: '启用', hit_count: 8, version: 'V3' },
  { level1: '合规规则', level2: '来源标注', detail: '所有数据必须标注来源及统计口径', material_type: '全部类型', status: '启用', hit_count: 5, version: 'V3' },
  { level1: '合规规则', level2: '禁用词',   detail: '禁止使用"稳赚""保本""零风险"等词汇', material_type: '全部类型', status: '启用', hit_count: 21, version: 'V3' },
  { level1: '文本校对', level2: '一致性',   detail: '基金代码/名称须与备案信息一致', material_type: '全部类型', status: '启用', hit_count: 15, version: 'V3' },
  { level1: '文本校对', level2: '格式规范', detail: '日期格式统一为 YYYY-MM-DD', material_type: '文档类', status: '启用', hit_count: 9, version: 'V3' },
  { level1: '指标校对', level2: '数值范围', detail: '费率/金额须在产品要素表允许范围内', material_type: '全部类型', status: '启用', hit_count: 6, version: 'V3' }
];

/* ============== 角色 & 用户（PRD 六、三角色） ============== */
const ROLES = [
  { key: 'uploader', name: '上传方', description: '提交营销物料、跟踪审核进度', member_count: 12 },
  { key: 'reviewer', name: '审核员', description: '处理 AI 初审结果、人工复核与决策', member_count: 6 },
  { key: 'admin',    name: '管理员', description: '规则库 / 模型配置 / 知识库 / 权限管理', member_count: 3 }
];
const USERS = [
  { username: 'uploader', name: '李晓华', role: 'uploader', dept: '市场部',     status: '启用', last_active: '2026-07-13' },
  { username: 'reviewer', name: '王审核', role: 'reviewer', dept: '合规审核部', status: '启用', last_active: '2026-07-14' },
  { username: 'admin',    name: '钱进',   role: 'admin',    dept: '合规管理部', status: '启用', last_active: '2026-07-14' }
];

/* ============== 审核任务 ============== */
const TASKS = [
  { task_no: 'P000843', filename: '易方达安瑞短债债券C_宣传海报.jpg', task_type: '图片审核', material_type: '宣传推介', status: '审核成功', review_status: '待人工复核', creator: '李晓华', created_at: '2026-07-13 09:23', confidence: 76, decision: 'handoff', decision_reason: '', handoff: 1 },
  { task_no: 'P000842', filename: '理财说明书_2026Q3.docx',        task_type: '文档审核', material_type: '营销材料', status: '审核成功', review_status: '通过',     creator: '李晓华', created_at: '2026-07-12 16:45', confidence: 97, decision: 'pass',   decision_reason: 'AI 初审通过，无命中规则', handoff: 0 },
  { task_no: 'P000839', filename: 'H5_养老目标基金.png',           task_type: '图片审核', material_type: '宣传推介', status: '审核成功', review_status: '不通过',   creator: '李晓华', created_at: '2026-07-11 14:10', confidence: 41, decision: 'reject', decision_reason: '命中 2 条合规规则（禁用词+收益承诺）', handoff: 0 },
  { task_no: 'P000835', filename: '投教_资产配置.pdf',             task_type: '文档审核', material_type: '投教材料', status: '审核成功', review_status: '通过',     creator: '李晓华', created_at: '2026-07-10 11:30', confidence: 95, decision: 'pass',   decision_reason: 'AI 初审通过', handoff: 0 },
  { task_no: 'P000834', filename: '营销活动海报_Q3.png',           task_type: '图片审核', material_type: '营销材料', status: '审核成功', review_status: '通过',     creator: '李晓华', created_at: '2026-07-14 10:00', confidence: 92, decision: 'pass',   decision_reason: 'AI 初审通过', handoff: 0 }
];

/* P000843 的完整审核结果（驱动「审核详情」页，跨组全局连续编号：文本校对#1#2→指标校对#3#4→合规规则#5#6） */
const RESULT_P000843 = {
  anno_boxes: [
    { id: 'box1', anno: 5, top: '0%',  left: '0.5%', width: '99%', height: '13%', tag: '#5 业绩宣称待验证', kind: 'danger' },
    { id: 'box3', anno: 4, top: '26%', left: '2%',   width: '96%', height: '24%', tag: '#4 历史收益率数据',   kind: 'warn' },
    { id: 'box4', anno: 1, top: '51%', left: '2%',   width: '96%', height: '10%', tag: '#1 基金基本信息',   kind: 'warn' },
    { id: 'box5', anno: 6, top: '62%', left: '2%',   width: '96%', height: '18%', tag: '#6 收益数据表格',   kind: 'danger' },
    { id: 'box6', anno: 2, top: '81%', left: '2%',   width: '96%', height: '19%', tag: '#2 风险提示与说明', kind: 'info' },
    { id: 'box2', anno: 3, top: '13%', left: '2%',   width: '96%', height: '12%', tag: '#3 成立时间声明',   kind: 'warn' }
  ],
  cards: [
    { idx: '#1', anno: 1, group: '文本校对', status: 'pass', tag: 'num-correct', label: '[正确]', desc: '基金名称「易方达安瑞短债债券C」与代码 006320 在中国证监会基金备案信息中一致 ✓', reason: '', reasonType: '', time: '' },
    { idx: '#2', anno: 2, group: '文本校对', status: 'pass', tag: 'num-correct', label: '[正确]', desc: '底部免责声明包含"基金有风险投资需谨慎""过往业绩不预示未来"等法定必备提示文字 ✓ · 完整性检查通过 ✓', reason: '', reasonType: '', time: '' },
    { idx: '#3', anno: 3, group: '指标校对', status: 'pend', tag: 'num-ai', label: '[AI标]', desc: '海报标注成立日期为 2018年11月14日，距今已超 7 年，模型可判定该产品可正常展示历史业绩，但建议人工确认首次披露时间节点', reason: '成立时间较早，模型无法自动确认成立后 6 个月内是否曾违规展示业绩，已自动标记「待人工核对」', reasonType: 'pend', time: '2026-07-13 16:20:02' },
    { idx: '#4', anno: 4, group: '指标校对', status: 'pass', tag: 'num-correct', label: '[正确]', desc: '柱状图区域 2014-2021 年度净值增长率数据与公开披露一致 ✓ · 同业基准对比来源有效（中证综合债指数）✓', reason: '数据校验通过：8个年度数据点均可在基金定期报告中找到对应值', reasonType: 'pass', time: '' },
    { idx: '#5', anno: 5, group: '合规规则', status: 'fail', tag: 'num-ai', label: '[AI标]', desc: '海报顶部使用「成立以来业绩突出」等绝对化表述，涉嫌误导投资者对产品收益的预期判断', reason: '命中规则：不得使用「业绩突出」等绝对化宣传用语', reasonType: 'fail', time: '2026-07-13 16:20:00' },
    { idx: '#6', anno: 6, group: '合规规则', status: 'fail', tag: 'num-rule', label: '[合规规则]', desc: '详细收益指标表展示成立以来收益 17.63%、近1年 2.89% 等历史业绩数据，但未在数据旁附注足够醒目的风险提示', reason: '命中规则：展示历史业绩数据时必须在同一视觉区域附带风险提示文字', reasonType: 'fail', time: '2026-07-13 16:20:01' }
  ],
  confidence: 76,
  conclusion: '待人工复核',
  ocr_text: '易方达安瑞短债债券C · 灵活闲钱投资看短债 · 安瑞短债券C成立以来业绩突出 · 基金代码 006320 · 成立于2018年11月14日 · 历史净值增长率 2014-2021 ... · 风险提示与免责声明 ...',
  agent_outputs: { ocr: 0.992, multimodal: 0.95, entity: 0.96, validate: 0.93, rule: 0.88, parse: 0.90, decision: 0.76 }
};

/* ============== 知识库 / 合规源（对齐 PRD 知识工程：基金核心实体 / 合规规则 / 高频错误案例 三库分流） ============== */
const KNOWLEDGE = [
  // ① 基金核心实体库
  { type: 'entity',  category: '基金核心实体', title: '易方达安瑞短债债券C 备案信息', content: '基金代码 006320；成立日 2018-11-14；管理人 易方达基金；风险等级 R2（中低风险）。', source: '基金备案数据库 ODP', version: 'V3', compliance_level: 'high', status: '启用' },
  // ② 合规规则库（内规 / 外规）
  { type: 'rule',    category: '合规规则',   title: '成立不满 6 个月不得展示业绩', content: '基金产品成立不足 6 个月的，不得在宣传推介材料中展示该产品的历史业绩。', source: '《证券投资基金销售管理办法》', version: 'V3', compliance_level: 'high', status: '启用' },
  { type: 'rule',    category: '合规规则',   title: '法定风险揭示语句标准模板', content: '基金有风险，投资需谨慎。过往业绩不预示其未来表现，也不代表对未来的收益承诺……', source: '《公开募集证券投资基金销售机构监督管理办法》', version: 'V2', compliance_level: 'high', status: '启用' },
  { type: 'rule',    category: '合规规则',   title: '绝对化宣传用语负面清单', content: '稳赚、保本、零风险、业绩突出、guaranteed 等词汇禁止出现在营销物料中。', source: '合规词库 V3', version: 'V3', compliance_level: 'med', status: '启用' },
  // ③ 高频错误案例库（Badcase / Goodcase 回流，PRD 5.3）
  { type: 'badcase',  category: '高频错误案例', title: '「业绩突出」绝对化用语误用', content: '海报使用「成立以来业绩突出」绝对化表述，涉嫌误导收益预期，应改为「同期业绩表现」并附同区风险提示。', source: '审核 Badcase 库 #214', version: 'V1', compliance_level: 'high', status: '启用' },
  { type: 'goodcase', category: '高频错误案例', title: '收益数据表 + 同区风险提示（合规范例）', content: '历史业绩表旁以 ≥10px 字号附注风险提示，模型判定合规通过，置信度 0.97。', source: '审核 Goodcase 库 #089', version: 'V1', compliance_level: 'med', status: '启用' }
];

/* ============== 评测中心（对齐 PRD 4.3 模型性能对比表） ============== */
const EVALS = [
  { model: 'Qwen-VL-7B（本地）',  ocr_acc: 96, multimodal_acc: 85, entity_f1: 92, compliance_acc: 94, latency: 300, dataset: 'Fund-Eval-500', accuracy: 95, note: 'OCR 专用，轻量本地部署，摊销成本低', kind: 'good' },
  { model: 'Qwen-VL-Max（云端）', ocr_acc: 99, multimodal_acc: 95, entity_f1: 96, compliance_acc: 98, latency: 150, dataset: 'Fund-Eval-500', accuracy: 98, note: 'V1 推荐主力，图表理解显著增强', kind: 'good' },
  { model: 'DeepSeek-V2（云端）', ocr_acc: 98, multimodal_acc: 93, entity_f1: 95, compliance_acc: 97, latency: 180, dataset: 'Fund-Eval-500', accuracy: 97, note: '开源可私有化，性价比次之', kind: 'good' },
  { model: 'GPT-4V（云端）',       ocr_acc: 99, multimodal_acc: 96, entity_f1: 97, compliance_acc: 98.5, latency: 200, dataset: 'Fund-Eval-500', accuracy: 98, note: '公网模型·敏感数据不出域禁止', kind: 'bad' }
];

/* ============== 播种 ============== */
function seed(force = false) {
  if (force) reset();

  if (!get('SELECT COUNT(*) c FROM agents').c) {
    AGENTS.forEach(a => run(
      'INSERT INTO agents(key,name,model,thinking,threshold,enabled,role_desc,compliance_sensitive,order_idx) VALUES(?,?,?,?,?,?,?,?,?)',
      [a.key, a.name, a.model, a.thinking, a.threshold, a.enabled, a.role_desc, a.compliance_sensitive, a.order_idx]));
  }
  if (!get('SELECT COUNT(*) c FROM rules').c) {
    RULES.forEach(r => run(
      'INSERT INTO rules(level1,level2,detail,material_type,status,hit_count,version,created_at) VALUES(?,?,?,?,?,?,?,?)',
      [r.level1, r.level2, r.detail, r.material_type, r.status, r.hit_count, r.version, '2026-07-01']));
  }
  if (!get('SELECT COUNT(*) c FROM roles').c) {
    ROLES.forEach(r => run('INSERT INTO roles(key,name,description,member_count) VALUES(?,?,?,?)',
      [r.key, r.name, r.description, r.member_count]));
  }
  if (!get('SELECT COUNT(*) c FROM users').c) {
    USERS.forEach(u => run(
      'INSERT INTO users(username,name,role,dept,status,last_active) VALUES(?,?,?,?,?,?)',
      [u.username, u.name, u.role, u.dept, u.status, u.last_active]));
  }
  if (!get('SELECT COUNT(*) c FROM tasks').c) {
    TASKS.forEach(t => {
      run(
        'INSERT INTO tasks(task_no,filename,task_type,material_type,status,review_status,creator,created_at,confidence,decision,decision_reason,handoff) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
        [t.task_no, t.filename, t.task_type, t.material_type, t.status, t.review_status, t.creator, t.created_at, t.confidence, t.decision, t.decision_reason, t.handoff]);
      if (t.task_no === 'P000843') {
        const tid = get('SELECT id FROM tasks WHERE task_no=?', [t.task_no]).id;
        run('INSERT INTO review_results(task_id,anno_boxes_json,cards_json,confidence,conclusion,ocr_text,agent_outputs_json) VALUES(?,?,?,?,?,?,?)',
          [tid, JSON.stringify(RESULT_P000843.anno_boxes), JSON.stringify(RESULT_P000843.cards),
           RESULT_P000843.confidence, RESULT_P000843.conclusion, RESULT_P000843.ocr_text, JSON.stringify(RESULT_P000843.agent_outputs)]);
      }
    });
  }
  if (!get('SELECT COUNT(*) c FROM knowledge').c) {
    KNOWLEDGE.forEach(k => run(
      'INSERT INTO knowledge(type,category,title,content,source,version,compliance_level,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)',
      [k.type, k.category, k.title, k.content, k.source, k.version, k.compliance_level, k.status, '2026-07-05']));
  }
  if (!get('SELECT COUNT(*) c FROM evals').c) {
    EVALS.forEach(e => run(
      'INSERT INTO evals(model,ocr_acc,multimodal_acc,entity_f1,compliance_acc,latency,dataset,accuracy,note,kind) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [e.model, e.ocr_acc, e.multimodal_acc, e.entity_f1, e.compliance_acc, e.latency, e.dataset, e.accuracy, e.note, e.kind]));
  }
  if (!get('SELECT COUNT(*) c FROM config_kv').c) {
    [
      ['fallback_model', 'Qwen-72B（本地·敏感数据）'],   // PRD V2 混合：敏感数据本地处理
      ['default_threshold', '0.80'],                       // PRD 6.1 置信度<80% 转人工
      ['auto_handoff_below', '0.80']
    ].forEach(([k, v]) => run('INSERT INTO config_kv(key,value) VALUES(?,?)', [k, v]));
  }
  const c = (t) => get('SELECT COUNT(*) c FROM ' + t).c;
  console.log('[seed] 数据已就绪：', {
    agents: c('agents'), rules: c('rules'), tasks: c('tasks'),
    users: c('users'), knowledge: c('knowledge'), evals: c('evals')
  });
}

module.exports = { seed, RESULT_P000843 };

if (require.main === module) {
  db.initSchema();
  seed(process.argv.includes('--force'));
}
