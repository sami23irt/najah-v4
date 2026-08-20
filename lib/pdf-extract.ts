import { extractText, getDocumentProxy } from "unpdf";

const MIN_EXTRACTED_CHARS = 200;

/**
 * Extracts plain text from a PDF buffer. Throws "PDF_TEXT_TOO_SHORT" if the
 * document doesn't yield enough real text (e.g. a scanned image with no OCR
 * layer) — we deliberately refuse to summarize/quiz on empty content instead
 * of letting the model hallucinate a "summary" of nothing.
 */
export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const cleaned = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < MIN_EXTRACTED_CHARS) {
    throw new Error("PDF_TEXT_TOO_SHORT");
  }
  return cleaned;
}
