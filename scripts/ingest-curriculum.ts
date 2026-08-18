/**
 * Usage: pnpm ingest --file ./curriculum/math-2bac.txt --title "الرياضيات - الثانية باكالوريا" --level 2BAC --subject الرياضيات
 *
 * Extract text from source PDFs separately (e.g. with `pdftotext`) before
 * running this — this script embeds and stores already-extracted text,
 * it doesn't do PDF parsing itself.
 */
import { readFileSync } from "node:fs";
import { ingestCurriculumDocument } from "../lib/rag";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) throw new Error(`Missing --${name}`);
  return process.argv[i + 1];
}

async function main() {
  const filePath = arg("file");
  const title = arg("title");
  const level = arg("level") as "3AC" | "TRC" | "1BAC" | "2BAC";
  const subject = arg("subject");
  const rawText = readFileSync(filePath, "utf-8");

  const result = await ingestCurriculumDocument({
    title,
    level,
    subject,
    sourceType: "official_curriculum",
    rawText,
  });

  console.log(`Ingested "${title}" -> document #${result.documentId}, ${result.chunkCount} chunks embedded.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
