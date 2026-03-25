import { jsPDF } from "jspdf";

export function buildResumePdfBuffer(text: string, heading: string): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text(heading, 40, 48);
  doc.setFontSize(10);
  const body = text.replace(/\r\n/g, "\n");
  const lines = doc.splitTextToSize(body, 515);
  doc.text(lines, 40, 72);
  const out = doc.output("arraybuffer");
  return Buffer.from(out);
}
