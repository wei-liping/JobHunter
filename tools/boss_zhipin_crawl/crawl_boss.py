#!/usr/bin/env python3
"""
BOSS 直聘职位爬虫（DrissionPage）：列表监听 joblist + 可选详情页补全 JD；
导出 JSON/CSV；可选导入 JobHunter（POST /api/jobs，及 POST /api/applications）。
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_LIST_URL = (
    "https://www.zhipin.com/web/geek/jobs?"
    "query=%E5%A4%A7%E6%95%B0%E6%8D%AE%E5%BC%80%E5%8F%91&city=101280600"
)

# 详情页仅保留与 JD 相关的分节标题（BOSS PC 端常见 h3 + .job-sec-text）
BOSS_JD_SECTION_INCLUDE = (
    "职位描述",
    "岗位职责",
    "任职要求",
    "职位要求",
    "工作内容",
    "岗位要求",
)
BOSS_JD_SECTION_EXCLUDE = (
    "公司信息",
    "公司介绍",
    "工商信息",
    "推荐职位",
    "看了该职位",
    "相似职位",
    "公司地址",
    "工作地址",
    "地图",
    "查看全部",
    "资深招聘顾问",
    "公司相册",
    "面试评价",
    "精选职位",
)


def emit_stream_event(enabled: bool, typ: str, data: dict[str, Any]) -> None:
    if not enabled:
        return
    try:
        print(
            json.dumps({"type": typ, "data": data}, ensure_ascii=False),
            flush=True,
        )
    except Exception:
        # Keep crawler resilient even if streaming output fails.
        pass


def _fmt_list(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, list):
        parts = [str(x).strip() for x in val if x is not None and str(x).strip()]
        return "、".join(parts)
    return str(val).strip()


def _job_key(job: dict[str, Any]) -> str | None:
    eid = job.get("encryptJobId") or job.get("encryptJobIdStr")
    if eid:
        return str(eid)
    lid = job.get("lid") or job.get("jobId")
    if lid:
        return str(lid)
    return None


def job_detail_url(job: dict[str, Any]) -> str | None:
    eid = job.get("encryptJobId") or job.get("encryptJobIdStr")
    if not eid:
        return None
    return f"https://www.zhipin.com/job_detail/{eid}.html"


def build_jd_text(job: dict[str, Any]) -> str:
    lines: list[str] = [
        "（以下由 BOSS 列表接口抓取生成，非完整职位描述；详情见下文「岗位职责与详情」段落或手动补充。）",
        "",
        f"职位：{job.get('jobName') or ''}",
        f"公司：{job.get('brandName') or ''}",
        f"薪资：{job.get('salaryDesc') or ''}",
        f"城市/区域：{job.get('cityName') or ''} {job.get('areaDistrict') or ''} {job.get('businessDistrict') or ''}".strip(),
        f"经验：{job.get('jobExperience') or ''}",
        f"学历：{job.get('jobDegree') or ''}",
        f"公司规模：{job.get('brandScaleName') or ''}",
        f"领域：{job.get('brandIndustry') or ''}",
    ]
    skills = _fmt_list(job.get("skills"))
    if skills:
        lines.append(f"标签/技能（来自 BOSS 列表）：{skills}")
    welfare = _fmt_list(job.get("welfareList"))
    if welfare:
        lines.append(f"福利：{welfare}")
    for key in ("jobDesc", "postDescription", "encryptJobDesc", "jobDetail"):
        raw = job.get(key)
        if isinstance(raw, str) and raw.strip():
            lines.extend(["", "摘要/描述：", raw.strip()])
            break
    return "\n".join(lines).strip() or "（列表接口无正文，占位）"


def merge_list_and_detail_jd(job: dict[str, Any]) -> str:
    base = build_jd_text(job)
    detail = job.get("_detail_body")
    if isinstance(detail, str) and detail.strip():
        return (
            f"{base}\n\n---\n\n岗位职责与详情（详情页·已按分节裁剪）\n\n{detail.strip()}"
        )
    if job.get("_detail_fetch_failed"):
        return (
            f"{base}\n\n---\n\n（详情页正文抓取失败，请手动补充 JD 或使用 JobHunter 截图识别。）"
        )
    return base


def job_to_jobhunter_payload(job: dict[str, Any]) -> dict[str, Any]:
    title = (job.get("jobName") or "").strip() or "（无标题）"
    company = (job.get("brandName") or "").strip() or "（未知公司）"
    salary = (job.get("salaryDesc") or "").strip() or None
    url = job_detail_url(job)
    skills = job.get("skills")
    requirements: list[str] = []
    if isinstance(skills, list):
        requirements = [str(s).strip() for s in skills if str(s).strip()]
    elif isinstance(skills, str) and skills.strip():
        requirements = [skills.strip()]
    return {
        "title": title,
        "company": company,
        "salary": salary,
        "jdText": merge_list_and_detail_jd(job),
        "requirements": requirements,
        "url": url,
        "platform": "BOSS",
    }


def parse_joblist_response(body: Any) -> list[dict[str, Any]]:
    if not isinstance(body, dict):
        return []
    zp = body.get("zpData")
    if not isinstance(zp, dict):
        return []
    jl = zp.get("jobList")
    if not isinstance(jl, list):
        return []
    out: list[dict[str, Any]] = []
    for item in jl:
        if isinstance(item, dict):
            out.append(item)
    return out


def normalize_response_body(body: Any) -> dict[str, Any] | None:
    if isinstance(body, (bytes, bytearray)):
        try:
            body = body.decode("utf-8")
        except Exception:
            body = str(body)
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except json.JSONDecodeError:
            return None
    if isinstance(body, dict):
        return body
    return None


def extract_description_from_detail_json(data: dict[str, Any]) -> str:
    """优先 zpData.jobInfo 等单一职位描述字段，避免递归扫到公司介绍等长文本。"""
    zp = data.get("zpData")
    if isinstance(zp, dict):
        ji = zp.get("jobInfo") or zp.get("job") or zp.get("jobDetail")
        if isinstance(ji, dict):
            for k in (
                "postDescription",
                "jobDesc",
                "encryptJobDesc",
                "postDesc",
                "positionDetail",
                "jobDescription",
            ):
                v = ji.get(k)
                if isinstance(v, str) and len(v.strip()) > 30:
                    return v.strip()
        for k in ("jobDesc", "postDescription", "encryptJobDesc"):
            v = zp.get(k)
            if isinstance(v, str) and len(v.strip()) > 30:
                return v.strip()
    # 顶层偶尔直接带 job 对象
    job = data.get("jobInfo") or data.get("job")
    if isinstance(job, dict):
        for k in ("postDescription", "jobDesc", "encryptJobDesc"):
            v = job.get(k)
            if isinstance(v, str) and len(v.strip()) > 30:
                return v.strip()
    return ""


import re as _re

_BOSS_WATERMARK_RE = _re.compile(
    r"boss直聘|boss\s*直聘|kanzhun|zhipin|boss|直聘",
    _re.IGNORECASE,
)


def _strip_boss_watermark(text: str) -> str:
    return _BOSS_WATERMARK_RE.sub("", text).strip()


def _section_heading_text(sec: Any) -> str:
    for loc in ("tag:h3", "tag:h2", "css:h3", "css:.name"):
        try:
            el = sec.ele(loc, timeout=0.5)
            if el is not None:
                t = (getattr(el, "text", None) or "").strip()
                if t:
                    return _strip_boss_watermark(t)
        except Exception:
            continue
    return ""


def _section_body_text(sec: Any) -> str:
    try:
        inner = sec.ele("css:.job-sec-text", timeout=0.5)
        if inner is not None:
            return _strip_boss_watermark((getattr(inner, "text", None) or ""))
    except Exception:
        pass
    try:
        return _strip_boss_watermark((getattr(sec, "text", None) or ""))
    except Exception:
        return ""


def extract_job_description_sections(page: Any) -> str:
    """只拼接「职位描述」等相关分节，跳过公司/推荐等区块。"""
    parts: list[str] = []
    section_selectors = (
        "css:.job-detail .job-sec",
        "css:.job-detail-section .job-sec",
        "css:.job-detail-section",
        "css:.job-sec",
        "css:[class*='job-desc']",
    )
    sections: list[Any] = []
    for selector in section_selectors:
        try:
            sections = page.eles(selector)
        except Exception:
            sections = []
        if sections:
            break

    for sec in sections:
        title = _section_heading_text(sec)
        if not title:
            continue
        if any(x in title for x in BOSS_JD_SECTION_EXCLUDE):
            continue
        if not any(x in title for x in BOSS_JD_SECTION_INCLUDE):
            continue
        body = _section_body_text(sec)
        if len(body) < 15:
            continue
        parts.append(f"【{title}】\n{body}")

    return "\n\n".join(parts).strip()


def extract_detail_job_tags(page: Any) -> list[str]:
    """详情页职位标签（短文本），与公司/推荐区大块文字区分。"""
    seen: set[str] = set()
    out: list[str] = []
    selectors = (
        "css:.job-tags span",
        "css:.job-tags a",
        "css:.job-tags li",
        "css:.job-detail-section .tag-list li",
        "css:ul.tag-list li",
    )
    for sel in selectors:
        try:
            for el in page.eles(sel):
                try:
                    t = (el.text or "").strip()
                except Exception:
                    continue
                if not t or len(t) > 24:
                    continue
                if t in seen:
                    continue
                seen.add(t)
                out.append(t)
        except Exception:
            continue
    return out


def extract_detail_dom(page: Any) -> str:
    """
    详情页正文：JD 分节 + 可选标签行；避免整页 job-detail 混采。
    分节失败时再尝试极窄兜底（仅职位描述节下的 .job-sec-text）。
    """
    sections = extract_job_description_sections(page)
    tags = extract_detail_job_tags(page)
    tag_block = ""
    if tags:
        tag_block = "【职位标签（详情页）】\n" + "、".join(tags)

    if sections and tag_block:
        return f"{sections}\n\n{tag_block}"
    if sections:
        return sections
    # Tags-only detail is not considered a successful JD extraction.
    # Keep fallback paths available to try getting actual responsibilities text.
    if tag_block:
        return ""

    # 兜底：第一个「职位描述」分节内的 .job-sec-text
    try:
        for sec in page.eles("css:.job-detail .job-sec"):
            title = _section_heading_text(sec)
            if "职位描述" in title or "岗位职责" in title:
                body = _section_body_text(sec)
                if len(body) >= 15:
                    return body
    except Exception:
        pass

    # 最后兜底：job-detail 内首个 .job-sec-text（可能仍含杂项，但比全页扫描窄）
    try:
        el = page.ele("css:.job-detail .job-sec-text", timeout=1)
        if el is not None:
            t = _strip_boss_watermark((el.text or ""))
            if len(t) >= 15:
                return t
    except Exception:
        pass

    return ""


def fetch_detail_for_job(
    page: Any,
    url: str,
    *,
    detail_dom_wait: float,
    detail_listen_keyword: str | None,
    listen_timeout: float,
) -> tuple[str, bool]:
    """
    Returns (detail_text, success). success True if non-empty body extracted.
    """
    try:
        page.get(url)
    except Exception as e:
        print(f"  detail get failed {url}: {e}", file=sys.stderr)
        return "", False

    time.sleep(max(0.5, detail_dom_wait))

    dom_text = extract_detail_dom(page)

    if dom_text.strip():
        return dom_text.strip(), True

    listen_keywords = (
        [detail_listen_keyword]
        if detail_listen_keyword
        else [
            "job_detail",
            "zpgeek/job/detail",
            "/wapi/zpgeek/job/detail.json",
            "/wapi/zpgeek/job/card.json",
            "job/card",
        ]
    )
    for keyword in listen_keywords:
        try:
            page.listen.start(keyword)
            try:
                page.refresh()
            except Exception:
                page.get(url)
            end_at = time.time() + max(1.0, listen_timeout)
            while time.time() < end_at:
                remaining = max(0.2, end_at - time.time())
                resp = page.listen.wait(timeout=remaining)
                if not resp or not hasattr(resp, "response"):
                    break
                body = normalize_response_body(resp.response.body)
                if isinstance(body, dict):
                    jt = extract_description_from_detail_json(body)
                    if jt.strip():
                        return jt.strip(), True
        except Exception as e:
            print(f"  detail listen failed: {e}", file=sys.stderr)
        finally:
            try:
                page.listen.pause()
            except Exception:
                try:
                    page.listen.stop()
                except Exception:
                    pass

    return "", False


def run_list_phase(
    page: Any,
    list_url: str,
    pages: int,
    sleep_s: float,
    max_jobs: int | None = None,
    stream: bool = False,
) -> dict[str, dict[str, Any]]:
    collected: dict[str, dict[str, Any]] = {}
    page.listen.start("joblist")
    print(f"Opening: {list_url}")
    page.get(list_url)

    for p in range(1, pages + 1):
        print(f"========== list page {p}/{pages} ==========")
        try:
            resp = page.listen.wait(timeout=45)
            body = normalize_response_body(resp.response.body)
            if not isinstance(body, dict):
                print(f"Unexpected body type: {type(body)}", file=sys.stderr)
            else:
                jobs = parse_joblist_response(body)
                for job in jobs:
                    key = _job_key(job) or job_detail_url(job) or json.dumps(
                        job, sort_keys=True, ensure_ascii=True
                    )[:200]
                    if key and key not in collected:
                        collected[key] = job
                        print(f"  + {job.get('jobName')} @ {job.get('brandName')}")
                        emit_stream_event(
                            stream,
                            "job",
                            {
                                "id": key,
                                "title": job.get("jobName") or "",
                                "company": job.get("brandName") or "",
                                "salary": job.get("salaryDesc") or "",
                                "city": job.get("cityName") or "",
                                "experience": job.get("jobExperience") or "不限",
                                "education": job.get("jobDegree") or "不限",
                                "platform": "BOSS直聘",
                                "companySize": job.get("brandScaleName") or "不限",
                                "score": 0,
                            },
                        )
                        if max_jobs is not None and len(collected) >= max_jobs:
                            break
                emit_stream_event(
                    stream,
                    "progress",
                    {
                        "phase": "list",
                        "page": p,
                        "pages": pages,
                        "total": len(collected),
                    },
                )
                if max_jobs is not None and len(collected) >= max_jobs:
                    break
        except Exception as e:
            print(f"Listen/parse failed: {e}", file=sys.stderr)
            emit_stream_event(
                stream,
                "error",
                {
                    "stage": "list_listen",
                    "message": str(e),
                    "page": p,
                },
            )
        if max_jobs is not None and len(collected) >= max_jobs:
            break

        if p < pages:
            try:
                page.scroll.to_bottom()
            except Exception as e:
                print(f"scroll failed: {e}", file=sys.stderr)
            time.sleep(max(0.0, sleep_s))

    return collected


def run_detail_phase(
    page: Any,
    jobs: list[dict[str, Any]],
    *,
    max_details: int | None,
    detail_sleep: float,
    detail_dom_wait: float,
    detail_listen_keyword: str | None,
    listen_timeout: float,
    stream: bool = False,
) -> None:
    try:
        page.listen.pause()
    except Exception:
        try:
            page.listen.stop()
        except Exception:
            pass

    limit = len(jobs) if max_details is None else min(len(jobs), max_details)
    for i, job in enumerate(jobs[:limit], 1):
        url = job_detail_url(job)
        if not url:
            job["_detail_fetch_failed"] = True
            print(f"  [{i}/{limit}] skip (no detail url)")
            continue
        title = job.get("jobName") or url
        print(f"  [{i}/{limit}] detail: {title}")
        text, ok = fetch_detail_for_job(
            page,
            url,
            detail_dom_wait=detail_dom_wait,
            detail_listen_keyword=detail_listen_keyword,
            listen_timeout=listen_timeout,
        )
        if ok:
            job["_detail_body"] = text
        else:
            job["_detail_fetch_failed"] = True
        emit_stream_event(
            stream,
            "progress",
            {
                "phase": "detail",
                "index": i,
                "total": limit,
                "ok": bool(ok),
            },
        )
        if i < limit:
            time.sleep(max(0.0, detail_sleep))


def write_outputs(
    out_dir: Path,
    rows: list[dict[str, Any]],
    prefix: str,
) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = out_dir / f"{prefix}_{ts}.json"
    csv_path = out_dir / f"{prefix}_{ts}.csv"

    payloads = [job_to_jobhunter_payload(j) for j in rows]
    json_path.write_text(
        json.dumps(payloads, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    fieldnames = [
        "title",
        "company",
        "salary",
        "url",
        "platform",
        "requirements",
        "jdText",
    ]
    with csv_path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for p in payloads:
            row = dict(p)
            req = p.get("requirements") or []
            row["requirements"] = json.dumps(req, ensure_ascii=False) if req else ""
            w.writerow(row)

    return json_path, csv_path


def _is_duplicate_application_error(status: int, body: str) -> bool:
    if status not in (400, 409, 500):
        return False
    b = body.lower()
    return (
        "unique constraint" in b
        or "p2002" in b
        or ("jobid" in b and "resumeid" in b and "duplicate" in b)
    )


def http_json(
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    timeout: float = 90,
) -> tuple[int, Any]:
    data = None
    headers: dict[str, str] = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(raw)
            except json.JSONDecodeError:
                return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed


def resolve_resume_id(base_url: str, resume_id_arg: str | None) -> str | None:
    if not resume_id_arg:
        return None
    if resume_id_arg.lower() != "auto":
        return resume_id_arg
    root = base_url.rstrip("/")
    code, data = http_json(f"{root}/api/resumes")
    if code != 200 or not isinstance(data, list) or not data:
        print("GET /api/resumes failed or empty; cannot use --resume-id auto", file=sys.stderr)
        return None
    rid = data[0].get("id") if isinstance(data[0], dict) else None
    if not rid:
        return None
    print(f"Using first resume from API: {rid}")
    return str(rid)


def import_to_jobhunter(
    base_url: str,
    rows: list[dict[str, Any]],
    resume_id: str | None,
    *,
    stream: bool = False,
) -> None:
    root = base_url.rstrip("/")
    jobs_url = f"{root}/api/jobs"
    apps_url = f"{root}/api/applications"

    total = len(rows)
    for i, job in enumerate(rows, 1):
        payload = job_to_jobhunter_payload(job)
        stream_id = _job_key(job) or ""
        body_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            jobs_url,
            data=body_bytes,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                try:
                    job_obj = json.loads(raw)
                except json.JSONDecodeError:
                    print(f"[job {i}/{total}] non-JSON: {raw[:300]}", file=sys.stderr)
                    continue
                job_id = job_obj.get("id") if isinstance(job_obj, dict) else None
                print(f"[job {i}/{total}] {resp.status} id={job_id}")
                if stream and job_id and stream_id:
                    emit_stream_event(
                        True,
                        "job_persisted",
                        {"streamId": stream_id, "persistedId": str(job_id)},
                    )
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            print(f"[job {i}/{total}] HTTP {e.code}: {err[:500]}", file=sys.stderr)
            continue
        except Exception as e:
            print(f"[job {i}/{total}] error: {e}", file=sys.stderr)
            continue

        if not resume_id or not job_id:
            continue

        app_payload = {"jobId": job_id, "resumeId": resume_id}
        try:
            code, result = http_json(apps_url, method="POST", payload=app_payload)
        except Exception as e:
            print(f"[app {i}/{total}] error: {e}", file=sys.stderr)
            continue

        if code in (200, 201):
            app_id = result.get("id") if isinstance(result, dict) else None
            print(f"[app {i}/{total}] {code} applicationId={app_id}")
            continue

        body_str = json.dumps(result, ensure_ascii=False) if isinstance(result, dict) else str(result)
        if _is_duplicate_application_error(code, body_str):
            print(f"[app {i}/{total}] skip duplicate (job+resume already exists)")
        else:
            print(
                f"[app {i}/{total}] HTTP {code}: {body_str[:500]}",
                file=sys.stderr,
            )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="BOSS job list + optional detail JD (DrissionPage), import to JobHunter",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_LIST_URL,
        help="BOSS 职位列表页 URL（需包含 query/city 等）",
    )
    parser.add_argument("--pages", type=int, default=4, help="列表翻页次数")
    parser.add_argument(
        "--sleep",
        type=float,
        default=10.0,
        help="列表每页采集后休眠秒数",
    )
    parser.add_argument(
        "--profile-dir",
        type=Path,
        default=None,
        help="Chrome 用户数据目录；默认 tools/boss_zhipin_crawl/chrome_profile",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="输出目录；默认 boss_out",
    )
    parser.add_argument("--out-prefix", default="boss_jobs", help="输出文件名前缀")
    parser.add_argument(
        "--import",
        dest="import_url",
        metavar="BASE_URL",
        default=None,
        help="导入 JobHunter，例如 http://localhost:3000",
    )
    parser.add_argument(
        "--fetch-details",
        action="store_true",
        help="二阶段：打开每个 job_detail 页补全 JD（DOM 优先）",
    )
    parser.add_argument(
        "--detail-sleep",
        type=float,
        default=10.0,
        help="详情页之间的休眠秒数",
    )
    parser.add_argument(
        "--detail-dom-wait",
        type=float,
        default=5.0,
        help="打开详情页后等待渲染的秒数",
    )
    parser.add_argument(
        "--detail-listen-keyword",
        default=None,
        metavar="SUBSTR",
        help="若 DOM 为空，可指定监听 URL 子串尝试解析 JSON 描述",
    )
    parser.add_argument(
        "--detail-listen-timeout",
        type=float,
        default=35.0,
        help="详情监听 wait 超时（秒）",
    )
    parser.add_argument(
        "--max-details",
        type=int,
        default=None,
        help="最多抓取详情条数（默认不限制）",
    )
    parser.add_argument(
        "--max-jobs",
        type=int,
        default=None,
        help="最多抓取职位条数（默认不限制）",
    )
    parser.add_argument(
        "--resume-id",
        default=None,
        metavar="ID_OR_auto",
        help="导入后为每条职位创建投递；填简历 id 或 auto（取 GET /api/resumes 第一条）",
    )
    parser.add_argument(
        "--stream",
        action="store_true",
        help="stdout 输出 NDJSON 事件（供 SSE 实时推送）",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).resolve().parent
    profile_dir = args.profile_dir or (script_dir / "chrome_profile")
    out_dir = args.out_dir or (script_dir / "boss_out")

    if args.resume_id and not args.import_url:
        print("Warning: --resume-id only applies with --import", file=sys.stderr)

    try:
        from DrissionPage import ChromiumOptions, ChromiumPage
    except ImportError:
        print(
            "DrissionPage 未安装。请先: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt",
            file=sys.stderr,
        )
        return 1

    co = ChromiumOptions(read_file=False)
    co.set_user_data_path(str(profile_dir))
    co.headless(False)

    page = ChromiumPage(addr_or_opts=co)
    emit_stream_event(
        args.stream,
        "start",
        {
            "url": args.url,
            "pages": args.pages,
            "fetchDetails": bool(args.fetch_details),
        },
    )

    try:
        collected = run_list_phase(
            page,
            args.url,
            args.pages,
            args.sleep,
            max_jobs=args.max_jobs,
            stream=args.stream,
        )
        rows = list(collected.values())
        if not rows:
            print(
                "No jobs collected. Check login, URL, or listen keyword 'joblist'.",
                file=sys.stderr,
            )
            emit_stream_event(
                args.stream,
                "error",
                {"stage": "list", "message": "No jobs collected"},
            )
            return 2

        if args.fetch_details:
            print("========== detail phase ==========")
            run_detail_phase(
                page,
                rows,
                max_details=args.max_details,
                detail_sleep=args.detail_sleep,
                detail_dom_wait=args.detail_dom_wait,
                detail_listen_keyword=args.detail_listen_keyword,
                listen_timeout=args.detail_listen_timeout,
                stream=args.stream,
            )
    finally:
        try:
            page.listen.pause()
        except Exception:
            pass
        try:
            page.quit()
        except Exception:
            pass

    json_path, csv_path = write_outputs(out_dir, rows, args.out_prefix)
    print(f"Wrote JSON: {json_path}")
    print(f"Wrote CSV:  {csv_path}")

    if args.import_url:
        resume_id = resolve_resume_id(args.import_url, args.resume_id)
        if args.resume_id and args.resume_id.lower() == "auto" and not resume_id:
            return 3
        import_to_jobhunter(
            args.import_url,
            rows,
            resume_id,
            stream=bool(args.stream),
        )

    emit_stream_event(
        args.stream,
        "done",
        {
            "total": len(rows),
            "imported": bool(args.import_url),
        },
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
