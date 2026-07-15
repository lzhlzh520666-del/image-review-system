'use strict';
/**
 * 大模型客户端 —— OpenAI 兼容接口（通义千问 DashScope / 智谱 GLM 等通用）。
 * 通过环境变量切换厂商，底层 POST 格式统一（/chat/completions + Bearer）。
 *
 * 环境变量（写进 backend/.env，已 .gitignore 忽略，绝不入库）：
 *   LLM_API_KEY      必填，形如 sk-xxxx 或 智谱 xxxx.xxxx
 *   LLM_BASE_URL     必填，OpenAI 兼容 base，如：
 *                       通义千问: https://dashscope.aliyuncs.com/compatible-mode/v1
 *                       智谱 GLM: https://open.bigmodel.cn/api/paas/v4
 *   LLM_TEXT_MODEL   文本类智能体模型名（默认 qwen-max）
 *   LLM_VL_MODEL     视觉类智能体模型名（默认 qwen-vl-max）
 *   （旧名 DASHSCOPE_* / QWEN_* 作为回退，向后兼容）
 *
 * 无 key 时 chatText/chatVision 抛 LLMNotConfiguredError，由流水线回落到启发式。
 */
const BASE = process.env.LLM_BASE_URL || process.env.DASHSCOPE_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const TEXT_MODEL = process.env.LLM_TEXT_MODEL || process.env.QWEN_TEXT_MODEL || 'qwen-max';
const VL_MODEL = process.env.LLM_VL_MODEL || process.env.QWEN_VL_MODEL || 'qwen-vl-max';

function apiKey() { return process.env.LLM_API_KEY || process.env.DASHSCOPE_API_KEY || ''; }
function configured() { return !!apiKey(); }

class LLMNotConfiguredError extends Error {
  constructor() {
    super('大模型未配置（缺少 API Key），已回落到启发式模拟结果');
    this.code = 'LLM_NOT_CONFIGURED';
  }
}

/**
 * 底层 POST。messages: [{role,content}]；json=true 时要求模型返回 JSON。
 */
async function _post(messages, { model, json, temperature = 0.3, max_tokens = 2000 } = {}) {
  const key = apiKey();
  if (!key) throw new LLMNotConfiguredError();
  const body = { model, messages, temperature, max_tokens: max_tokens };
  if (json) body.response_format = { type: 'json_object' };

  let resp;
  try {
    resp = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body)
    });
  } catch (e) {
    throw new Error(`调用大模型网络失败：${e.message}`);
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`LLM ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = await resp.json();
  const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
  if (!json) return content;
  try {
    return JSON.parse(content);
  } catch {
    return { _raw: content };
  }
}

/** 纯文本对话（实体识别 / 规则审核 / 决策 智能体）。 */
async function chatText({ system, user, json, temperature, max_tokens }) {
  return _post(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { model: TEXT_MODEL, json, temperature, max_tokens }
  );
}

/** 视觉多模态对话（OCR / 多模态解析 / 错点定位 智能体）。 */
async function chatVision({ system, user, imageBase64, imageMime = 'image/jpeg', json, temperature, max_tokens }) {
  const imageUrl = imageBase64.startsWith('data:')
    ? imageBase64
    : `data:${imageMime};base64,${imageBase64}`;
  const content = [
    { type: 'image_url', image_url: { url: imageUrl } },
    { type: 'text', text: user }
  ];
  return _post(
    [{ role: 'system', content: system }, { role: 'user', content }],
    { model: VL_MODEL, json, temperature, max_tokens }
  );
}

module.exports = {
  configured, chatText, chatVision, LLMNotConfiguredError,
  TEXT_MODEL: () => TEXT_MODEL,
  VL_MODEL: () => VL_MODEL
};
