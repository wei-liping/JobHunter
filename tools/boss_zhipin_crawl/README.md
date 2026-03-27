# BOSS 直聘列表 + 详情爬虫（实验）

使用 [DrissionPage](https://drissionpage.cn/) 监听包含 `joblist` 的接口响应，从 `zpData.jobList` 读取结构化数据；可选**二阶段**打开每个 `job_detail` 页，**仅拼接与 JD 相关的分节**（如「职位描述」「任职要求」），并单独采集**职位标签**短文本，避免把公司介绍、推荐职位等整页混进 `jdText`。列表里的 `skills` 会写入 `requirements`，并在 `jdText` 列表摘要中标为「标签/技能（来自 BOSS 列表）」。

**说明**：此为个人本地实验脚本，请自行遵守 BOSS 直聘服务条款与适用法律；低频、小页数使用。BOSS 改版后分节 class 可能变化；失败时可用 `--detail-listen-keyword` 从详情 XHR 取 `zpData.jobInfo` 类字段，或在 JobHunter 用**截图识别**补全 JD。

## 环境

- Python 3.9+（推荐 3.10–3.12；`.venv` 勿提交仓库）
- 本机已安装 Chrome / Chromium

```bash
cd tools/boss_zhipin_crawl
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 首次登录（持久会话）

脚本默认将用户数据目录设为 **`chrome_profile/`**（已在仓库 `.gitignore`）。首次运行会打开可视化浏览器，在 BOSS 完成登录即可；之后复用 Cookie。清空登录可删除 `chrome_profile/`。

## 运行示例

仅列表（占位 `jdText`）：

```bash
source .venv/bin/activate
python crawl_boss.py --pages 3 --sleep 12
```

列表 + **详情补全** + 导入职位 + **创建投递**（首页列表可见）：

```bash
# 先启动 JobHunter：npm run dev，并确认数据库可用
python crawl_boss.py --fetch-details --detail-sleep 12 --max-details 10 \
  --import http://localhost:3000 --resume-id auto
```

`--resume-id auto`：调用 `GET /api/resumes`，取**返回列表第一条**的 `id`（适合只有一份简历时）。也可显式传入简历 id：

```bash
curl -s http://localhost:3000/api/resumes   # 查看 id
python crawl_boss.py --fetch-details --import http://localhost:3000 --resume-id clxxxx...
```

## 常用参数

| 参数 | 说明 |
| --- | --- |
| `--url` | 职位列表页完整 URL |
| `--pages` | 列表翻页次数，默认 `4` |
| `--sleep` | 列表每页后休眠秒数，默认 `10` |
| `--fetch-details` | 二阶段打开详情页补全 JD |
| `--detail-sleep` | 详情页之间休眠，默认 `10` |
| `--detail-dom-wait` | 打开详情后等待渲染秒数，默认 `7`（与 `JOBHUNTER_CRAWL_DETAIL_DOM_WAIT` 一致） |
| `--detail-listen-keyword` | DOM 为空时，监听 URL 含该子串的响应并尝试从 JSON 抽描述 |
| `--max-details` | 最多抓详情条数（调试/限流） |
| `--import BASE_URL` | `POST /api/jobs` 导入每条职位 |
| `--resume-id` | 与 `--import` 合用：每条职位后再 `POST /api/applications`；可用 `auto` |
| `--profile-dir` / `--out-dir` / `--out-prefix` | 浏览器目录、输出目录、文件名前缀 |

输出：`boss_out/boss_jobs_<UTC>.json` 与 `.csv`；JSON 对齐 `POST /api/jobs`（`platform: "BOSS"`）。`jdText` = 列表摘要 +「岗位职责与详情（详情页·已按分节裁剪）」段落（若抓取失败会有说明文案）。

## 通过 JobHunter 首页触发（可选）

本地 `npm run dev` 时，首页「**本地 BOSS 抓取**」卡片会请求 `POST /api/crawl/local`，由 Next 在本机执行 `tools/boss_zhipin_crawl/crawl_boss.py`（需已配置 `.venv` 与 `chrome_profile` 登录）。非 development 环境需在 `.env` 设置 `JOBHUNTER_ALLOW_LOCAL_CRAWL=1`；可用 `JOBHUNTER_CRAWL_PYTHON` 指定 Python 路径。平台选「其他」时接口返回 501。

### 抓取节奏（风控与速度）

默认由环境变量传入子进程（与直接命令行 `--sleep`、`--detail-sleep`、`--detail-dom-wait`、`--detail-listen-timeout` 一致）：

- `JOBHUNTER_CRAWL_LIST_SLEEP`：列表翻页间隔（秒）
- `JOBHUNTER_CRAWL_DETAIL_SLEEP`：详情页之间间隔（秒）
- `JOBHUNTER_CRAWL_DETAIL_DOM_WAIT`：打开详情后等待 DOM 渲染（秒）
- `JOBHUNTER_CRAWL_DETAIL_LISTEN_TIMEOUT`：JSON 监听兜底单次上限（秒）

建议先只调前两项，观察是否出现验证码、空白页或频繁失败；再视情况降低 DOM 等待或监听超时（可能增加采空或失败率）。也可在 `POST /api/crawl/local` 的 JSON body 中传 `listSleep`、`detailSleep`、`detailDomWait`、`detailListenTimeout`（数字）覆盖环境变量；岗位探索页的 SSE 支持同名 query 参数。

详情阶段：单条详情若首次未采到正文，会**自动再跑一轮**（中间休眠与 `--detail-sleep` 一致）；监听循环会**跳过 Content-Type 明确非 JSON 的响应**（减少埋点/统计请求误命中）。

## 排错

- **listen 无 joblist**：F12 网络里确认列表 XHR 是否仍含 `joblist`。
- **详情正文为空**：BOSS 改版后 class 可能变化，可试 `--detail-listen-keyword`（在 XHR 里找一个稳定子串）；仍失败请用手动或截图识别。
- **导入成功但首页无列表**：未传 `--resume-id` 时只建 `Job`，不建 `Application`；首页列表来自投递，需 `--resume-id`。
- **重复导入投递**：同一 `jobId + resumeId` 已存在时会跳过并提示 duplicate（基于响应文案判断）。
- **`--resume-id auto` 退出码 3**：`/api/resumes` 为空或失败，请先在应用里创建简历。

## 与主项目的关系

- 通过 [`/api/jobs`](../../src/app/api/jobs/route.ts)、[`/api/applications`](../../src/app/api/applications/route.ts)、[`/api/resumes`](../../src/app/api/resumes/route.ts) 导入；另可选 [`POST /api/crawl/local`](../../src/app/api/crawl/local/route.ts) 在本机起子进程。
- 主流程仍可优先截图识别；本脚本用于批量拉列表 + 可选详情正文（已裁剪）。
