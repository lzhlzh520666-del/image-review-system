'use strict';
/**
 * 大模型客户端 —— 阿里云百炼 DashScope（OpenAI 兼容 /compatible-mode）。
 *
 * 选型依据 PRD 4.2 / 3.3：V1 阶段推荐 Qwen-Max 系列。
 *  - 文本类智能体（实体识别 / 规则审核 / 决策）：Qwen-Max
 *  - 视觉类智能体（OCR / 多模态解析 / 错点定位）：Qwen-VL-Max
 *
 * 环境变量（写进 backend/.env，已被 .gitignore 忽略，绝不入库）：
 *   DASHSCOPE_API_KEY   必填，形如 sk-xxxx
 *   DASHSCOPE_BASE      可选，默认 https://dashscope.aliyuncs.com/compatible-mode/v1
 *   QWEN_TEXT_MODEL    可选，默认 qwen-max
 *   QWEN_VL_MODEL      可选，默认 qwen-vl-max
 *
 * 无 key 时 chatText/chatVision 抛 LLMNotConfiguredError，由流水线回落到启发式。
 */
const BASE = process.env.DASHSCOPE_BASE || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const TEXT_MODEL = process.env.QWEN_TEXT_MODEL || 'qwen-max';
const VL_MODEL = process.env.QWEN_VL_MODEL || 'qwen-vl-max';

function apiKey() { return process.env.DASHSCOPE_API_KEY || ''; }
function configured() { return !!apiKey(); }

class LLMNotConfiguredError extends Error {
  constructor() {
    super('大模型未配置（缺少 DASHSCOPE_API_KEY），已回落到启发式模拟结果');
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
    throw new Error(`DashScope ${resp.status}: ${txt.slice(0, 300)}`);
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
