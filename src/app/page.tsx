import Link from "next/link";
import {
  BriefcaseBusiness,
  ClipboardList,
  FolderKanban,
  MessagesSquare,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";

function isDemoBuild(): boolean {
  const x = process.env.NEXT_PUBLIC_DEMO_MODE?.trim().toLowerCase();
  return x === "1" || x === "true" || x === "yes";
}

const cards = [
  {
    href: "/explore",
    emoji: "🔎",
    title: "岗位探索",
    subtitle: "连接本机 BOSS 搜索",
    subtitleDemo: "AI 产品经理岗位快照",
    description:
      "搜索职位、查看 JD、挑选值得继续跟进的岗位，并决定是否加入职位看板。",
    descriptionDemo:
      "浏览预抓取的一线城市 AI 产品经理相关岗位与 JD，并进入简历优化。",
    icon: BriefcaseBusiness,
  },
  {
    href: "/resume",
    emoji: "📝",
    title: "简历优化",
    subtitle: "评估、润色、开场白",
    subtitleDemo: "评估、润色、开场白（自备 Key）",
    description:
      "围绕目标岗位完成 AI 评估、简历润色与开场白生成，并按需保存新版本。",
    descriptionDemo:
      "使用自备 API Key 体验评估与润色；简历版本保存在本浏览器。",
    icon: ClipboardList,
  },
  {
    href: "/interview",
    emoji: "🎙️",
    title: "模拟面试",
    subtitle: "纯文本多轮对话",
    subtitleDemo: "多轮对话（仅存本机）",
    description: "选择岗位与简历开始模拟问答，历史对话会自动进入内容管理。",
    descriptionDemo: "在本浏览器保存模拟面试对话（演示版不落库）。",
    icon: MessagesSquare,
  },
  {
    href: "/content",
    emoji: "🗂️",
    title: "内容管理",
    subtitle: "岗位、简历、投递、面试、复盘",
    subtitleDemo: "本浏览器中的简历与面试",
    description: "集中查看职位看板、简历版本、投递进展，以及后续复盘记录。",
    descriptionDemo:
      "查看快照岗位与本地保存的简历、面试记录（演示版无投递复盘）。",
    icon: FolderKanban,
  },
] as const;

export default function HomePage() {
  const demo = isDemoBuild();
  return (
    <AppShell
      className="gap-16"
      hero={
        <div className="space-y-8 py-10 text-center sm:py-16">
          <p className="text-sm text-muted-foreground">你的 AI 求职助手</p>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-[-0.06em] text-foreground sm:text-6xl">
              Job Hunter
              <span className="mx-3 text-sky-200">—</span>
              求职全链路工作台
            </h1>
            <p className="mx-auto max-w-2xl text-base leading-8 text-muted-foreground sm:text-xl">
              {demo
                ? "在线演示：静态岗位库 + 自备 API Key；简历与面试记录仅存本浏览器。"
                : "从找岗位、改简历，到模拟面试和内容沉淀，放到一套更清晰、更轻量的流程里。"}
            </p>
          </div>
        </div>
      }
    >
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[2rem] border border-sky-100 bg-white/88 p-6 shadow-[0_12px_36px_rgba(59,130,246,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_18px_48px_rgba(59,130,246,0.14)]"
            >
              <div className="space-y-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                      <span className="mr-2 text-[0.9em]">{card.emoji}</span>
                      {card.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {"subtitleDemo" in card && demo
                        ? card.subtitleDemo
                        : card.subtitle}
                    </p>
                  </div>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {"descriptionDemo" in card && demo
                      ? card.descriptionDemo
                      : card.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
