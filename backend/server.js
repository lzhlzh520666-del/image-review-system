'use strict';
/**
 * 启动入口：建表 → 播种 → 注册 API 路由 → 静态托管原型。
 * 运行：node server.js        (端口 process.env.PORT || 3000)
 * 默认托管 ../ (即「AI图片审核系统原型/」目录) 下的 v1-review-prototype.html。
 */
const http = require('http');
const path = require('path');
const { loadEnv } = require('./src/core/env');
const { initSchema, getDb } = require('./src/core/db');
const { serveStatic } = require('./src/core/http');
const Router = require('./src/core/router');
const seed = require('./src/config/seed').seed;
const registerRoutes = require('./src/routes');

const ROOT = path.join(__dirname, '..'); // AI图片审核系统原型/（backend 的上一级）
const PROTOTYPE = 'v1-review-prototype.html';
const PORT = process.env.PORT || 3000;

loadEnv();
initSchema();
seed();

const router = new Router();
registerRoutes(router);

const server = http.createServer(async (req, res) => {
  try {
    const handled = await router.handle(req, res, {});
    if (handled !== false) return;
    // 未匹配 /api/* 的，按静态文件处理（原型）
    serveStatic(req, res, ROOT, PROTOTYPE);
  } catch (e) {
    console.error('[server] 处理出错', e);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: '内部错误: ' + (e && e.message) }));
    }
  }
});

server.listen(PORT, () => {
  console.log(`[server] AI 图片审核后端已启动：http://localhost:${PORT}`);
  console.log(`[server] 原型入口：http://localhost:${PORT}/${PROTOTYPE}`);
});

module.exports = server;
