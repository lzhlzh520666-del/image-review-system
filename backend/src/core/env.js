'use strict';
/**
 * 极简 .env 加载器（零依赖）。
 * 仅在 process.env 未设置时才写入，便于命令行覆盖。
 * 默认读取 backend/.env（与 server.js 同目录）。
 */
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  const target = file || path.join(__dirname, '..', '..', '.env');
  try {
    if (!fs.existsSync(target)) return false;
    const txt = fs.readFileSync(target, 'utf-8');
    txt.split('\n').forEach((line) => {
      const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) return;
      const key = m[1];
      let val = m[2];
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = { loadEnv };
