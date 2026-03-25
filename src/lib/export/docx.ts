import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";

export async function buildResumeDocxBuffer(
  text: string,
  heading: string,
): Promise<Buffer> {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: heading,
      heading: HeadingLevel.HEADING_1,
    }),
    ...text.split("\n").map(
      (line) =>
        new Paragraph({
          children: [new TextRun({ text: line || " " })],
        }),
    ),
  ];

  const doc = new Document({
    sections: [
      {
        children: paragraphs,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return buf;
}
