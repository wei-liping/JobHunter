import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Display name for PDF header (template export). */
export const RESUME_DISPLAY_NAME = "韦莉萍";

const CV_INFO_DIR = "cv_infor";
const CONTACT_FILE = "contact.txt";
const PHOTO_FILE = "cv.jpg";
const FALLBACK_AVATAR = "avatar.jpg";

/**
 * Escape text for LaTeX (outside \textbf/\href args that need special handling).
 */
function latexEscape(input: string): string {
  return input
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

/**
 * Inline **bold** and [text](url): placeholder, escape, restore.
 */
function processInlineMarkdown(segment: string): string {
  const links: { label: string; url: string }[] = [];
  let t = segment.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (_, label: string, url: string) => {
      const k = `◆LINK${links.length}◆`;
      links.push({ label, url });
      return k;
    },
  );
  const bolds: string[] = [];
  t = t.replace(/\*\*([^*]+)\*\*/g, (_, inner: string) => {
    const k = `◆BOLD${bolds.length}◆`;
    bolds.push(latexEscape(inner));
    return k;
  });
  t = latexEscape(t);
  bolds.forEach((b, i) => {
    t = t.replace(`◆BOLD${i}◆`, `\\textbf{${b}}`);
  });
  links.forEach((l, i) => {
    t = t.replace(
      `◆LINK${i}◆`,
      `\\href{${latexEscape(l.url)}}{${latexEscape(l.label)}}`,
    );
  });
  return t;
}

function parseContactLine(raw: string): { phone: string; email: string } {
  const line = raw.trim().split(/\r?\n/)[0] ?? "";
  const parts = line.split("|").map((p) => p.trim());
  if (parts.length >= 2) {
    return { phone: parts[0] ?? "", email: parts[1] ?? "" };
  }
  if (line.includes("@")) {
    return { phone: "", email: line };
  }
  return { phone: line, email: "" };
}

/**
 * Convert resume markdown to LaTeX body (no sample template content).
 * Consumes # / ## / ### / - / * / ** as structure, not literal symbols.
 */
export function markdownToLatexBody(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("\\end{itemize}");
      inList = false;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      closeList();
      out.push("");
      continue;
    }

    const heading3 = trimmed.match(/^###\s+(.+)$/);
    if (heading3) {
      closeList();
      out.push(`\\textbf{${latexEscape(heading3[1].trim())}}\\\\`);
      continue;
    }

    const heading2 = trimmed.match(/^##\s+(.+)$/);
    if (heading2) {
      closeList();
      out.push(
        `\\textbf{\\large ${latexEscape(heading2[1].trim())}}\\\\[0.3em]`,
      );
      continue;
    }

    const heading1 = trimmed.match(/^#\s+(.+)$/);
    if (heading1) {
      closeList();
      out.push(`\\section{${latexEscape(heading1[1].trim())}}`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!inList) {
        out.push("\\begin{itemize}[nosep]");
        inList = true;
      }
      out.push(`\\item ${processInlineMarkdown(bullet[1])}`);
      continue;
    }

    closeList();
    out.push(`${processInlineMarkdown(trimmed)}\\\\`);
  }

  closeList();
  return out.join("\n");
}

async function loadContact(
  workspaceRoot: string,
): Promise<{ phone: string; email: string }> {
  const candidates = [
    path.join(workspaceRoot, CV_INFO_DIR, CONTACT_FILE),
    path.join(workspaceRoot, "resume-template", CONTACT_FILE),
  ];
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, "utf8");
      return parseContactLine(raw);
    } catch {
      // try next candidate
    }
  }
  return { phone: "", email: "" };
}

async function copyPhotoToTemp(
  workspaceRoot: string,
  tempDir: string,
): Promise<string> {
  const dest = path.join(tempDir, FALLBACK_AVATAR);
  const candidates = [
    path.join(workspaceRoot, CV_INFO_DIR, PHOTO_FILE),
    path.join(workspaceRoot, CV_INFO_DIR, "CV.jpg"),
    path.join(workspaceRoot, CV_INFO_DIR, "avatar.jpg"),
    path.join(workspaceRoot, "resume-template", "CV.jpg"),
    path.join(workspaceRoot, "resume-template", FALLBACK_AVATAR),
  ];

  for (const src of candidates) {
    try {
      await fs.copyFile(src, dest);
      return FALLBACK_AVATAR;
    } catch {
      // try next candidate
    }
  }
  return FALLBACK_AVATAR;
}

/** Preamble through \\begin{document} + \\pagenumbering (from template, without sample body). */
function buildPreambleFromTemplate(templateTex: string): string {
  const docIdx = templateTex.indexOf("\\begin{document}");
  if (docIdx < 0) {
    throw new Error("resume-template/CV.tex missing \\begin{document}");
  }
  return templateTex.slice(0, docIdx + "\\begin{document}".length);
}

function buildHeaderBlock(
  displayName: string,
  contact: { phone: string; email: string },
  avatarFile: string,
): string {
  const contactParts: string[] = [];
  if (contact.phone) contactParts.push(`Tel: ${latexEscape(contact.phone)}`);
  if (contact.email) {
    const em = latexEscape(contact.email);
    contactParts.push(`Email: \\\\href{mailto:${em}}{${em}}`);
  }
  const contactLine =
    contactParts.length > 0 ? contactParts.join(" \\quad ") : "";

  return `
\\pagenumbering{gobble}

%%%% Stable plain-flow header (avoid viewer-dependent centerline/tikz behavior)
\\noindent{\\LARGE\\bfseries ${latexEscape(displayName)}}\\\\[0.3em]
${contactLine ? `\\noindent{\\normalsize ${contactLine}}\\\\[0.6em]` : ""}
\\noindent\\includegraphics[height=2.4cm]{${avatarFile}}\\\\[0.8em]
`;
}

export async function buildResumePdfWithTemplate(
  markdown: string,
): Promise<Buffer> {
  const workspaceRoot = process.cwd();
  const templateDir = path.join(workspaceRoot, "resume-template");
  const templatePath = path.join(templateDir, "CV.tex");
  const templateTex = await fs.readFile(templatePath, "utf8");

  const preamble = buildPreambleFromTemplate(templateTex);
  const contact = await loadContact(workspaceRoot);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "jobhunter-latex-"));

  try {
    await fs.cp(templateDir, tempDir, { recursive: true });
    const avatarFile = await copyPhotoToTemp(workspaceRoot, tempDir);

    const bodyLatex = markdownToLatexBody(markdown);
    const header = buildHeaderBlock(RESUME_DISPLAY_NAME, contact, avatarFile);

    const fullDoc = `${preamble}
${header}
${bodyLatex}
\\end{document}
`;

    const cvPath = path.join(tempDir, "CV.tex");
    await fs.writeFile(cvPath, fullDoc, "utf8");

    const { stderr } = await execFileAsync(
      "xelatex",
      ["-interaction=nonstopmode", "-halt-on-error", "CV.tex"],
      {
        cwd: tempDir,
        timeout: 120000,
        maxBuffer: 5 * 1024 * 1024,
      },
    );

    if (stderr && /!/m.test(stderr)) {
      console.error("[latex] xelatex stderr:", stderr.slice(-4000));
    }

    const pdfPath = path.join(tempDir, "CV.pdf");
    const pdf = await fs.readFile(pdfPath);
    return pdf;
  } catch (e) {
    const err = e as Error & { stderr?: string };
    const detail = err.stderr?.slice?.(0, 4000) ?? err.message;
    console.error("[latex] compile failed:", detail);
    throw new Error(
      `LaTeX compile failed: ${err.message}${detail ? `\n${detail}` : ""}`,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
