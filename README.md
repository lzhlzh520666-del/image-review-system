# AI 智能图片审核系统（金融营销物料合规审核 · 多智能体架构）

面向**基金营销物料**的 AI 智能图片/文档合规审核系统原型：以「多智能体协同」还原 PRD 中
OCR → 多模态解析 → 实体识别 → 数据校验 → 文本规则审核 → 错点解析 → 决策 的 7 节点审核流水线。

> 原型后端为**零依赖 Node 22 单文件 SQLite**实现，目标是 `node server.js` 一键跑通、便于演示与评审；
> 生产形态按 PRD 3.4 演进为 Spring Boot + FastAPI / MySQL + MongoDB + Milvus / Drools / Kafka / K8s + Docker。

---

## 一、架构总览

```
┌─────────────────────────── 前端（单文件 HTML 原型） ───────────────────────────┐
│  工作台 · 审核列表 · 审核详情(6卡片+标注框) · 规则库 · 模型配置 · 知识库 · 评测 │
└───────────────────────────────┬──────────────────────────────────────────────────┘
                                 │  fetch /api/*
┌───────────────────────────────┴──────────────────────────────────────────────────┐
│  后端（Node 22 · 零依赖 · 内置 node:sqlite）                                   │
│  Router → Services → node:sqlite(单文件 ai_review.db)                            │
│  7 智能体流水线 taskService.runPipeline()（确定性模拟，结构对齐 PRD 输出）          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### 7 智能体（PRD 3.3 / 4.2 V1 选型）
| # | 智能体 | 模型（V1） | 输出 |
|---|---------|-----------|------|
| 1 | OCR 智能体 | PaddleOCR v4（本地 GPU） | 结构化文本 |
| 2 | 多模态解析智能体 | Qwen-VL-Max（云端） | 图文对应文本 |
| 3 | 实体识别智能体 | BERT-NER / Qwen-Max | 基金代码/名称/日期等实体 |
| 4 | 数据校验智能体 | 规则引擎 + 知识图谱 | 一致性校验 |
| 5 | 文本规则审核智能体 | Qwen-Max + RAG 规则库（thinking） | 合规规则匹配 |
| 6 | 错点解析智能体 | CV 定位 + 文本对齐 | 错误坐标与说明 |
| 7 | 决策智能体 | 集成学习（Qwen-Max） | 风险评分 / 人工介入决策 |

**人工介入机制（PRD 6.1）**：流水线综合置信度 **< 0.80** 自动转人工复核（handoff）。

---

## 二、目录结构

```
AI图片审核系统原型/
├── backend/                    # 后端（零依赖 Node 22）
│   ├── server.js              # 启动入口：建表→播种→路由→静态托管原型
│   ├── smoke_test.cjs         # 全链路冒烟测试（node smoke_test.cjs）
│   ├── src/
│   │   ├── core/             # db(node:sqlite) / http / router
│   │   ├── config/seed.js    # 种子数据（严格对齐 PRD：7智能体/8规则/5任务/6知识/4评测）
│   │   ├── services/          # auth/user/rule/config/dashboard/knowledge/eval/task
│   │   └── routes/index.js   # /api 路由汇总
│   └── data/                 # ai_review.db（运行时生成，已被 .gitignore 忽略）
├── v1-review-prototype.html  # 前端原型（单文件，需置于 backend 同级目录）
├── _prd_docx.md              # PRD 主文档（安全落盘副本）
├── _prd_wiki.md              # PRD 面试稿 / wiki（安全落盘副本）
└── V1_MasterGo_设计规格.md  # MasterGo 设计规格
```

---

## 三、快速开始

**要求**：Node.js ≥ 22（需内置 `node:sqlite`）。

```bash
cd backend
npm start            # 等价于 node server.js
# 或自定义端口： PORT=8080 node server.js

# 访问
#   原型：   http://localhost:3000/v1-review-prototype.html
#   健康检查： http://localhost:3000/api/health

# 重新播种（清空数据再从 PRD 种子重建）
npm run seed        # 等价于 node src/config/seed.js --force

# 冒烟测试（另开终端，服务需已启动）
node smoke_test.cjs
```

首次启动会自动 `initSchema()` 建表并 `seed()` 播种演示数据（7 智能体 / 8 规则 / 5 审核任务 / 6 知识库 / 4 评测）。
其中任务 **P000843** 含完整 6 卡片审核结果与标注框，直接驱动「审核详情」页。

---

## 四、API 清单

基础前缀 `/api`。所有响应为 JSON；错误结构 `{ "error": "..." }`。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/login` | 角色直登（uploader / reviewer / admin） |
| GET | `/api/auth/me?role=` | 当前角色信息 |
| GET | `/api/users` `/api/roles` | 用户 / 角色 |
| GET | `/api/tasks` | 任务列表（支持 status / task_type / keyword 过滤） |
| GET | `/api/tasks/:id` | 任务详情（`:id` 可为任务号如 `P000843` 或数字 id） |
| POST | `/api/tasks` | 创建任务并触发 7 智能体流水线 |
| POST | `/api/tasks/:id/decide` | 人工决策（pass / reject / handoff）+ 回流 decisions |
| POST | `/api/tasks/:id/rerun` | 重跑流水线 |
| GET | `/api/rules` | 规则库列表（level1 / keyword 过滤） |
| POST | `/api/rules` | 新增规则 |
| PUT | `/api/rules/:id` | 编辑规则 |
| POST | `/api/rules/:id/toggle` | 规则启停切换 |
| GET | `/api/config/agents` | 7 智能体逐体配置 |
| PUT | `/api/config/agents/:key` | 更新智能体模型/阈值/启用 |
| GET | `/api/config/global` | 全局配置（fallback_model / 阈值） |
| PUT | `/api/config/global` | 更新全局配置 |
| GET | `/api/dashboard` | 工作台（4 KPI + 7 日趋势 + 结论分布 + 各智能体达标率） |
| GET | `/api/knowledge` | 知识库（type / category / keyword 过滤，三库分流） |
| POST | `/api/knowledge` | 新增知识条目 |
| PUT | `/api/knowledge/:id` | 编辑知识条目 |
| DELETE | `/api/knowledge/:id` | 删除知识条目 |
| GET | `/api/evals` | 评测中心列表 |
| POST | `/api/evals` | 新增评测 |

---

## 五、与 PRD 的对齐要点

- **知识工程三库分流**（PRD wiki）：基金核心实体库 / 合规规则库（内规+外规）/ 高频错误案例库（Badcase+Goodcase 回流）。
- **多模态幻觉优化**：OCR 与多模态解析共同解析图文关系，实体识别后将结构化信息组装进上下文（上下文工程）。
- **评测体系**（PRD 4.3）：本地 Qwen-VL-7B / 云端 Qwen-VL-Max / 云端 DeepSeek-V2 / 云端 GPT-4V（公网模型标注「敏感数据禁止出域」）。
- **项目分期**：MVP（本原型）→ 2.0（接入真实模型 + 流式 + 飞书/SSO 鉴权 + Kafka 事件总线）。

---

## 六、部署到 GitHub

本仓库为纯静态前端 + 零依赖后端，可直接推送到 GitHub：

```bash
git init            # 已在项目根目录初始化
git add .
git commit -m "init: AI 图片审核系统原型（多智能体后端 + 前端）"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

> 提示：`data/` 与 `*.db` 已被 `.gitignore` 忽略，克隆后执行 `node server.js` 会自动播种，无需提交数据库。

如需在 GitHub 上长期运行后端，可部署到任意支持 Node 22 的平台（Railway / Render / 飞书 Cloud Studio 等），
并设置环境变量 `PORT`。前端为单文件 HTML，可配合任意静态托管（GitHub Pages / Nginx / CDN）。

---

## 七、生产演进路线（PRD 3.4）

| 维度 | 本原型（MVP） | 生产目标 |
|------|---------------|----------|
| 语言/框架 | Node 22 单进程 | Spring Boot（编排）+ FastAPI（模型服务） |
| 存储 | 单文件 SQLite | MySQL（业务）+ MongoDB（素材/原图）+ Milvus（向量/RAG） |
| 规则引擎 | 内置 if/kw 启发式 | Drools（可热更新规则） |
| 异步 | 同步模拟 | Kafka 事件总线（任务/回调/回流） |
| 部署 | 本地 `node server.js` | K8s + Docker，多副本 |
| 鉴权 | 角色直登 | 飞书 OAuth / 企业 SSO |
