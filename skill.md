## JD CV Resume Workflow Skill Spec

> 说明：仓库策略会拦截新增 `SKILL.md` 文档文件，因此此处作为项目内可执行 skill 规范源。后文提供迁移到 Claude Code 的步骤。

### 目标

用户指定 JD 文件与 CV 文件后，执行完整流程：
1. 优化并生成匹配建议；
2. 生成开场白；
3. 以上结果输出为 Markdown 文件；
4. 使用现有 `resume-template/CV.tex` 编译最终 PDF（模板样式不改）。

### 输入约定

- 必填：
  - `jd_path`：JD 文件路径（`.md`/`.txt`）
  - `cv_path`：CV 文件路径（`.md`/`.txt`）
- 可选：
  - `output_dir`：输出目录（默认当前目录）
  - `optimized_cv_path`：若提供则用于最终 PDF；否则用 `cv_path`

### 职位名提取与命名规则

1. 优先从 JD 内容提取职位名（第一行非空标题，去掉 `#`/`##` 前缀）。
2. 若提取结果异常（过长或明显非标题），回退为 JD 文件名（去后缀）。
3. 文件名做安全化（去除 `/ \\ : * ? \" < > |`）。

输出文件名：
- `<职位名>-匹配建议.md`
- `<职位名>-开场白.md`
- `<职位名>-简历.pdf`

### 生成逻辑（与现有项目能力对齐）

#### 1) 匹配建议
- 语义与字段对齐 `src/prompts/scoring.ts`：
  - `matchScore`
  - `jdKeywords`
  - `hitKeywords`
  - `missingKeywords`
  - `weakPoints`
  - `summary`
- 将结果整理成 `<职位名>-匹配建议.md`。

#### 2) 开场白
- 语义对齐 `src/prompts/coverLetter.ts`（150-280 字中文开场白）。
- 写入 `<职位名>-开场白.md`。

#### 3) 最终 PDF
- 复用现有 LaTeX 导出能力（`src/lib/export/latex.ts`，函数 `buildResumePdfWithTemplate`）。
- 不修改 `resume-template/CV.tex` 样式，仅替换正文内容来源。
- 输出 `<职位名>-简历.pdf`。

### 使用示例

示例 1：基础模式（JD/CV -> 两个 md + PDF）
- 输入：
  - `jd_path=inputs/jd_product_manager.md`
  - `cv_path=inputs/cv_weiliping.md`
- 期望输出：
  - `产品经理-匹配建议.md`
  - `产品经理-开场白.md`
  - `产品经理-简历.pdf`

示例 2：指定输出目录
- 输入：
  - `output_dir=outputs/pm-2026-03`
- 输出写入该目录，命名规则不变。

示例 3：仅重编译 PDF
- 条件：
  - `optimized_cv_path` 已存在（例如人工微调后）
- 动作：
  - 仅执行 PDF 编译步骤，覆盖 `<职位名>-简历.pdf`。

### 失败处理

- JD/CV 文件不存在：直接报错并返回缺失路径。
- JD/CV 内容为空：报错并终止。
- `xelatex` 缺失：报错提示安装 TeX 发行版。
- 模板/字体问题：返回明确编译错误，不擅自修改模板风格。

### 迁移到 Claude Code 的步骤

1. 在 Claude Code 技能目录创建文件夹（示例）：
   - `~/.claude/skills/jd-cv-resume-workflow/`
2. 复制本节内容到：
   - `~/.claude/skills/jd-cv-resume-workflow/SKILL.md`
3. 保留 YAML 头（`name`、`description`），并将本节正文作为 `SKILL.md` 主体。
4. 重启 Claude Code / 重新加载技能后，用如下触发词测试：
   - “用这个 jd 和 cv 跑完整简历 workflow”
   - “生成匹配建议和开场白并导出 PDF”

建议的 `SKILL.md` 头部：

```yaml
---
name: jd-cv-resume-workflow
description: Run a JD+CV resume workflow that outputs match suggestions markdown, cover-letter markdown, and final PDF named by extracted job title while keeping existing LaTeX template style unchanged.
---
```

