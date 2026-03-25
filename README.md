# JobHunter AI（MVP）

Next.js 14 + Tailwind + shadcn/ui + Prisma + PostgreSQL + Playwright（可选）+ OpenAI 兼容 API 的求职自动化工作台：职位截图识别、AI 匹配分、STAR 简历定制、开场白、ATS 式状态、导出 PDF/Word。

## 项目结构

```
JobHunter/
├── prisma/
│   └── schema.prisma          # Job / Resume / Application / Score
├── src/
│   ├── app/
│   │   ├── api/               # Route Handlers（REST）
│   │   ├── applications/[id]/ # 三栏工作台页面
│   │   ├── layout.tsx
│   │   └── page.tsx           # 首页：创建投递 + 列表
│   ├── components/            # UI（shadcn 风格）
│   ├── generated/prisma/      # prisma generate 输出（勿手改）
│   ├── lib/
│   │   ├── ai/                # OpenAI 调用与业务封装
│   │   ├── crawler/           # Playwright 抓取 + 登录态预留
│   │   ├── export/            # PDF / Word
│   │   └── prisma.ts          # Prisma 单例（Pg 适配器）
│   └── prompts/               # 全部 LLM 提示词（独立文件）
├── docker-compose.yml         # 本地 PostgreSQL
├── prisma.config.ts           # Prisma 7 数据源配置
└── .env.example
```

## 环境变量

复制 `.env.example` 为 `.env`，填写：

- `DATABASE_URL` — PostgreSQL 连接串
- `OPENAI_API_KEY` — OpenAI 或兼容服务（如 DeepSeek）的 Key
- 可选 `OPENAI_BASE_URL`（例如 DeepSeek：`https://api.deepseek.com/v1`）
- 可选 `OPENAI_MODEL`（默认 `gpt-4o-mini`）
- `ALLOWED_AI_BASE_URLS` — 允许的 AI Base URL 白名单（逗号分隔）
- 可选 `JOBHUNTER_ADMIN_TOKEN` — 保护 `/api/ai/ping` 和飞书集成接口
- 可选飞书同步层：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_BITABLE_APP_TOKEN`、`FEISHU_BITABLE_TABLE_ID`、`FEISHU_BOT_WEBHOOK`

### 前端 API 设置（本地存储）

- 页面右上角支持「API 设置」弹窗，填写 `API Key / Base URL / 模型`。
- 配置保存在浏览器 `localStorage`，并在请求时通过请求头透传：
  - `x-openai-key`
  - `x-openai-base-url`
  - `x-openai-model`
- 后端读取顺序：请求头优先，`.env` 兜底。
- 当使用请求头配置时，`x-openai-key` 必填；`x-openai-base-url` 需命中 `ALLOWED_AI_BASE_URLS`。
- 安全提示：该方式适合本地单用户调试，不建议在公共终端使用。

## 本地运行

1. **安装依赖**

   ```bash
   npm install
   ```

2. **安装 Playwright 浏览器（仅在使用「抓取填充」时需要）**

   ```bash
   npx playwright install chromium
   ```

3. **启动数据库**

   ```bash
   docker compose up -d
   ```

   若无 Docker，请自备 PostgreSQL 并修改 `DATABASE_URL`。

4. **迁移数据库**

   ```bash
   npx prisma migrate dev --name init
   ```

   或开发阶段快速同步：

   ```bash
   npm run db:push
   ```

5. **启动开发服务**

   ```bash
   npm run dev
   ```

   浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 核心 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST | `/api/jobs` | 岗位列表 / 创建 |
| GET/PATCH/DELETE | `/api/jobs/[id]` | 岗位详情与更新 |
| GET/POST | `/api/resumes` | 简历列表 / 创建 |
| GET/PATCH | `/api/resumes/[id]` | 简历读写 |
| GET/POST | `/api/applications` | 投递列表 / 创建（关联 job + resume） |
| GET/PATCH/DELETE | `/api/applications/[id]` | 投递与状态 |
| POST | `/api/applications/[id]/score` | AI 匹配评分 |
| POST | `/api/applications/[id]/tailor-resume` | STAR 定制简历 JSON |
| POST | `/api/applications/[id]/cover-letter` | 开场白 |
| POST | `/api/ai/ping` | 测试当前 AI 配置连通性 |
| POST | `/api/vision/job-from-image` | 从职位截图识别并提取岗位结构化信息 |
| POST | `/api/resume-import` | 导入简历（PDF 或图片），提取为 Markdown |
| GET | `/api/applications/[id]/export/pdf` | 导出 PDF |
| GET | `/api/applications/[id]/export/docx` | 导出 Word |
| GET | `/api/applications/[id]/export/md` | 导出 Markdown |
| POST | `/api/crawler` | Playwright 抓取 `{ url, platform }` |
| POST | `/api/integrations/feishu/sync-application` | 同步单条投递到飞书多维表 |
| POST | `/api/integrations/feishu/sync-report` | 发送轻量报表到飞书机器人 |
| POST | `/api/integrations/feishu/notify` | 发送自定义通知到飞书机器人 |

## 状态流转（Application）

`new` →（评分）→ `scored_high` / `scored_low` → 可手动 `reviewed` → `ready_to_apply`。

## 说明

- **PDF 导出**：若存在 `resume-template/`（含 `CV.tex`、字体与 `fontawesomesymbols-*.tex`）且机器已安装 `xelatex`，则用模板生成 PDF（正文为简历 Markdown，不含模板内示例；不显示 `zju.png`）。抬头姓名见代码里 `RESUME_DISPLAY_NAME`（默认「韦莉萍」）；联系方式读取 `cv_infor/contact.txt`（推荐一行：`电话 | 邮箱`）；头像优先使用 `cv_infor/cv.jpg`（复制为 `avatar.jpg` 参与编译），否则使用模板自带 `avatar.jpg`。若 LaTeX 失败则回退 jsPDF；响应头 `X-Resume-Export-Mode` 为 `xelatex-template` 或 `jspdf-fallback`；调试时可在 URL 加 `?debug=1`，失败时返回 JSON 错误而非 PDF。
- **截图识别（Vision）**：需要在「API 设置」里选择支持图片输入的模型；不同供应商模型命名不同，若不支持会返回友好错误。
- **简历导入**：PDF 若为扫描件可能无法解析出文本，请改用图片上传（走 Vision）或先做 OCR。
- **爬虫（可选）**：各平台 DOM 与登录策略变化快，且常受反爬影响；当前主流程推荐用截图识别替代。
- **飞书定位**：飞书仅作为同步层（看板、通知、轻报表），主数据仍以 PostgreSQL 为准。

## Resume LaTeX Export Workflow (Skill Spec)

当你需要高质量简历排版（尤其中文 PDF）时，建议使用「Markdown 作为源 + Pandoc/LaTeX 编译」流程，而不是继续深度定制 jsPDF/docx API。

触发场景：
- 需要 `导出 markdown` / `导出 md`
- 反馈 `导出 pdf 乱码`
- 需要复用现有 LaTeX 模板
- 希望在 Cursor/Claude Code 中复现同一套导出动作

标准流程：
1. 从系统导出 `resume.md`（优先使用 tailored 内容）。
2. 准备模板目录：`template.tex`（可选 `metadata.yml`）。
3. 编译 PDF：
   - `pandoc resume.md -o resume.pdf --template=template.tex --pdf-engine=xelatex`
4. 可选编译 DOCX：
   - `pandoc resume.md -o resume.docx`
5. 检查输出：中文不乱码、层级与间距稳定、列表不丢失。

中文排版规则：
- 优先 `xelatex`（或 `lualatex`）。
- 字体配置放在 `template.tex`，避免依赖临时命令行参数。
- 若缺字/乱码，切换到本机可用 CJK 字体后重编译。

## 构建
```bash
npm run build
npm start
```
