import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireNotDemo } from "@/lib/demo/require-not-demo";

const patchBody = z.object({
  note: z.string().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  const { id } = await params;
  const json = await req.json();
  const data = patchBody.parse(json);
  const savedJob = await prisma.savedJob.update({
    where: { id },
    data: {
      ...(data.note !== undefined && { note: data.note }),
    },
    include: { job: true },
  });
  return NextResponse.json(savedJob);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const blocked = requireNotDemo();
  if (blocked) return blocked;
  const { id } = await params;
  await prisma.savedJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
