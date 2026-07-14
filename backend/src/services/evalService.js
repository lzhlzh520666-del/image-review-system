'use strict';
/** 评测中心：模型评测数据读写（PRD 5.3 Badcase/Goodcase 迭代）。 */
const { run, all, get } = require('../core/db');
function list() { return all('SELECT * FROM evals ORDER BY id'); }
function create({ model, ocr_acc, multimodal_acc, entity_f1, compliance_acc, latency, dataset, accuracy, note, kind }) {
  if (!model) return { error: 'model 必填' };
  const r = run(
    'INSERT INTO evals(model,ocr_acc,multimodal_acc,entity_f1,compliance_acc,latency,dataset,accuracy,note,kind) VALUES(?,?,?,?,?,?,?,?,?)',
    [model, ocr_acc, multimodal_acc, entity_f1, compliance_acc, latency, dataset || 'Fund-Eval-500', accuracy, note || '', kind || 'good']);
  return get('SELECT * FROM evals WHERE id=?', [r.lastId]);
}
module.exports = { list, create };
