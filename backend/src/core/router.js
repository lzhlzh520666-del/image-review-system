'use strict';
/** 极简路由：支持 :param，自动解析 query / body，注入 ctx。 */
const { readBody } = require('./http');

function Router() {
  this.routes = [];
}
Router.prototype.add = function (method, pattern, handler) {
  const keys = [];
  const rx = new RegExp('^' + pattern.replace(/:([^/]+)/g, (m, k) => {
    keys.push(k);
    return '([^/]+)';
  }) + '$');
  this.routes.push({ method, rx, keys, handler });
};
['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'].forEach((m) => {
  Router.prototype[m.toLowerCase()] = function (p, h) { this.add(m, p, h); };
});
Router.prototype.handle = async function (req, res, ctx) {
  const url = req.url.split('?')[0];
  for (const r of this.routes) {
    if (r.method !== req.method) continue;
    const m = r.rx.exec(url);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    const query = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT') body = await readBody(req);
    return r.handler(req, res, { ...ctx, params, query, body });
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization'
    });
    return res.end();
  }
  return false; // 未匹配
};

module.exports = Router;
