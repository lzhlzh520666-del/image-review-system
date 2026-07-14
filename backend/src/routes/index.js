'use strict';
/**
 * API 路由汇总。所有 /api/* 在此注册，handler 签名统一为 (req,res,{params,query,body})。
 * 业务在 services 层，本文件只做「参数透传 + 统一 JSON 出站」。
 */
const { json } = require('../core/http');

const authService = require('../services/authService');
const userService = require('../services/userService');
const ruleService = require('../services/ruleService');
const configService = require('../services/configService');
const dashboardService = require('../services/dashboardService');
const knowledgeService = require('../services/knowledgeService');
const evalService = require('../services/evalService');
const taskService = require('../services/taskService');

/* 统一出站：service 返回 null 视作 404，返回 {error} 视作 400。 */
function ok(res, data, status = 200) { json(res, status, data); }
function fail(res, status, msg) { json(res, status, { error: msg }); }

module.exports = function register(router) {
  /* ---------- 健康检查 ---------- */
  router.get('/api/health', (req, res) => ok(res, { ok: true, time: new Date().toISOString() }));

  /* ---------- 鉴权 ---------- */
  router.post('/api/auth/login', (req, res, { body }) => {
    const u = authService.login(body);
    if (!u) return fail(res, 401, '无效的角色');
    ok(res, u);
  });
  router.get('/api/auth/me', (req, res, { query }) => {
    const u = authService.me(query.role);
    if (!u) return fail(res, 401, '未登录或角色无效');
    ok(res, u);
  });

  /* ---------- 用户 & 角色 ---------- */
  router.get('/api/users', (req, res) => ok(res, userService.listUsers()));
  router.get('/api/roles', (req, res) => ok(res, userService.listRoles()));

  /* ---------- 审核任务（含 7 智能体流水线） ---------- */
  router.get('/api/tasks', (req, res, { query }) => ok(res, taskService.list(query)));
  router.get('/api/tasks/:id', (req, res, { params }) => {
    const t = taskService.detail(params.id);
    if (!t) return fail(res, 404, '任务不存在：' + params.id);
    ok(res, t);
  });
  router.post('/api/tasks', (req, res, { body }) => {
    const t = taskService.create(body);
    if (t && t.error) return fail(res, 400, t.error);
    ok(res, t, 201);
  });
  router.post('/api/tasks/:id/decide', (req, res, { params, body }) => {
    const r = taskService.decide(params.id, body);
    if (!r) return fail(res, 404, '任务不存在：' + params.id);
    if (r.error) return fail(res, 400, r.error);
    ok(res, r);
  });
  router.post('/api/tasks/:id/rerun', (req, res, { params }) => {
    const t = taskService.rerun(params.id);
    if (!t) return fail(res, 404, '任务不存在：' + params.id);
    ok(res, t);
  });

  /* ---------- 规则库 ---------- */
  router.get('/api/rules', (req, res, { query }) => ok(res, ruleService.list(query)));
  router.post('/api/rules', (req, res, { body }) => {
    const r = ruleService.create(body);
    if (r && r.error) return fail(res, 400, r.error);
    ok(res, r, 201);
  });
  router.put('/api/rules/:id', (req, res, { params, body }) => {
    const r = ruleService.update(+params.id, body);
    if (!r) return fail(res, 404, '规则不存在：' + params.id);
    ok(res, r);
  });
  router.post('/api/rules/:id/toggle', (req, res, { params }) => {
    const r = ruleService.toggle(+params.id);
    if (!r) return fail(res, 404, '规则不存在：' + params.id);
    ok(res, r);
  });

  /* ---------- 模型与智能体配置 ---------- */
  router.get('/api/config/agents', (req, res) => ok(res, configService.listAgents()));
  router.put('/api/config/agents/:key', (req, res, { params, body }) => {
    const r = configService.updateAgent(params.key, body);
    if (!r) return fail(res, 404, '智能体不存在：' + params.key);
    ok(res, r);
  });
  router.get('/api/config/global', (req, res) => ok(res, configService.getGlobal()));
  router.put('/api/config/global', (req, res, { body }) => ok(res, configService.setGlobal(body)));

  /* ---------- 工作台 ---------- */
  router.get('/api/dashboard', (req, res) => ok(res, dashboardService.dashboard()));

  /* ---------- 知识库 ---------- */
  router.get('/api/knowledge', (req, res, { query }) => ok(res, knowledgeService.list(query)));
  router.post('/api/knowledge', (req, res, { body }) => {
    const r = knowledgeService.create(body);
    if (r && r.error) return fail(res, 400, r.error);
    ok(res, r, 201);
  });
  router.put('/api/knowledge/:id', (req, res, { params, body }) => {
    const r = knowledgeService.update(+params.id, body);
    if (!r) return fail(res, 404, '知识条目不存在：' + params.id);
    ok(res, r);
  });
  router.delete('/api/knowledge/:id', (req, res, { params }) => {
    const r = knowledgeService.remove(+params.id);
    if (!r) return fail(res, 404, '知识条目不存在：' + params.id);
    ok(res, { ok: true, removed: r });
  });

  /* ---------- 评测中心 ---------- */
  router.get('/api/evals', (req, res) => ok(res, evalService.list()));
  router.post('/api/evals', (req, res, { body }) => {
    const r = evalService.create(body);
    if (r && r.error) return fail(res, 400, r.error);
    ok(res, r, 201);
  });
};
