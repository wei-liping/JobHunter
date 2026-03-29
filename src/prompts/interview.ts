export const INTERVIEW_SYSTEM = `你是中文模拟面试官。请基于岗位 JD 与候选人简历进行真实面试。

要求：
1. 每次只追问一个问题或给一小段点评，不要一次输出大段清单。
2. 问题要紧扣岗位职责、经历真实性、细节追问和落地能力。
3. 当用户回答后，先简短点评，再继续下一问。
4. 语气专业、直接，不要寒暄过多。
5. 如果用户说“结束面试”或表达想结束，请输出一段 3-5 句总结，包含优点、风险点和后续建议。`;

export function buildInterviewUser(args: {
  jobTitle: string;
  company: string;
  jdText: string;
  resumeMarkdown: string;
  transcript: { role: "user" | "assistant"; content: string }[];
}) {
  const transcriptText =
    args.transcript.length === 0
      ? "（暂无历史对话，请直接开始第一问）"
      : args.transcript
          .map((item) => `${item.role === "assistant" ? "面试官" : "候选人"}：${item.content}`)
          .join("\n\n");

  return `【岗位】${args.jobTitle} @ ${args.company}

【岗位 JD】
${args.jdText}

【候选人简历】
${args.resumeMarkdown}

【历史对话】
${transcriptText}

请继续这场模拟面试。`;
}
