import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createBody = z.object({
  title: z.string().optional(),
  rawMarkdown: z.string().min(1),
});

export async function GET() {
  const resumes = await prisma.resume.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json(resumes);
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const data = createBody.parse(json);
    const resume = await prisma.resume.create({
      data: {
        title: data.title ?? "我的简历",
        rawMarkdown: data.rawMarkdown,
      },
    });
    return NextResponse.json(resume);
  } catch (e: unknown) {
    throw e;
  }
}
