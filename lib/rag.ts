import { z } from "zod";
import { createServiceClient } from "./supabase-server";
import { fetchWithTimeout, readJsonWithLimit } from "./safe-fetch";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const EMBEDDING_MODEL = "gemini-embedding-001"; // 768 dims; text-embedding-004 was shut down Jan 14, 2026

/**
 * Splits raw curriculum text into overlapping semantic-ish chunks.
 * Splits on paragraph boundaries first, then hard-wraps anything still too
 * long, so we don't cut mid-sentence for the common case.
 */
export function chunkText(raw: string, maxChars = 1200, overlap = 150): string[] {
  const paragraphs = raw
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      // hard-wrap an overly long paragraph with overlap
      for (let i = 0; i < paragraph.length; i += maxChars - overlap) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function embedText(text: string, taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT" = "RETRIEVAL_QUERY"): Promise<number[]> {
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        embedContentConfig: {
          taskType,
          outputDimensionality: 768,
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Gemini embedding failed: ${response.status}`);
  }
  const data = await readJsonWithLimit<{ embedding: { values: number[] } }>(response, 256 * 1024);
  return data.embedding.values;
}

export type RetrievedChunk = {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  content: string;
  similarity: number;
};

const MIN_SIMILARITY = 0.72; // below this, we treat the KB as "no relevant context found"
const MAX_STUDENT_DOCUMENT_CHARS = 1_000_000;

/**
 * The actual retrieval step of RAG: embed the question, then find the
 * nearest curriculum chunks for that level+subject via the
 * match_curriculum_chunks() Postgres function (pgvector cosine distance).
 *
 * Returns an empty array if nothing is confidently relevant — the caller
 * (app/api/copilot/route.ts) is responsible for telling the student "I can't
 * confirm this from the curriculum" instead of guessing, per the quality
 * guardrail described in the project doc (section 3.4).
 */
export async function retrieveCurriculumContext(
  question: string,
  level: "3AC" | "TRC" | "1BAC" | "2BAC",
  subject: string,
  matchCount = 5
): Promise<RetrievedChunk[]> {
  const embedding = await embedText(question, "RETRIEVAL_QUERY");
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_curriculum_chunks", {
    query_embedding: embedding,
    match_level: level,
    match_subject: subject,
    match_count: matchCount,
  });

  if (error) throw new Error(`Retrieval failed: ${error.message}`);

  return (data ?? [])
    .filter((row: any) => row.similarity >= MIN_SIMILARITY)
    .map((row: any) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      content: row.content,
      similarity: row.similarity,
    }));
}

/** Ingests one curriculum document: chunk -> embed -> store. Used by scripts/ingest-curriculum.ts */
export async function ingestCurriculumDocument(params: {
  title: string;
  level: "3AC" | "TRC" | "1BAC" | "2BAC";
  subject: string;
  sourceType: string;
  sourceUrl?: string;
  storagePath?: string;
  rawText: string;
}) {
  const supabase = createServiceClient();
  const { data: doc, error: docError } = await supabase
    .from("curriculum_documents")
    .insert({
      title: params.title,
      level: params.level,
      subject: params.subject,
      source_type: params.sourceType,
      source_url: params.sourceUrl,
      storage_path: params.storagePath,
    })
    .select("id")
    .single();
  if (docError) throw new Error(`Failed to insert document: ${docError.message}`);

  const chunks = chunkText(params.rawText);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i], "RETRIEVAL_DOCUMENT");
    const { error: chunkError } = await supabase.from("curriculum_chunks").insert({
      document_id: doc.id,
      chunk_index: i,
      content: chunks[i],
      embedding,
    });
    if (chunkError) throw new Error(`Failed to insert chunk ${i}: ${chunkError.message}`);
  }
  return { documentId: doc.id, chunkCount: chunks.length };
}

// ---- Student-uploaded documents (study workspace) ---------------------------
// Same chunk -> embed -> store pipeline as ingestCurriculumDocument above, but
// for one student's own PDF/YouTube import instead of the shared curriculum
// knowledge base. Kept as a separate function because the caller (an API
// route) already owns the student_documents row (created up front so the
// student sees a "processing" state immediately).

export async function ingestStudentDocumentChunks(documentId: string, rawText: string): Promise<number> {
  if (rawText.length > MAX_STUDENT_DOCUMENT_CHARS) throw new Error("DOCUMENT_TEXT_TOO_LARGE");
  const supabase = createServiceClient();
  const chunks = chunkText(rawText);
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i], "RETRIEVAL_DOCUMENT");
    const { error } = await supabase.from("student_document_chunks").insert({
      document_id: documentId,
      chunk_index: i,
      content: chunks[i],
      embedding,
    });
    if (error) throw new Error(`Failed to store chunk ${i}: ${error.message}`);
  }
  return chunks.length;
}

export type RetrievedDocumentChunk = { chunkId: number; content: string; similarity: number };

/**
 * Retrieval for the study copilot: nearest chunks within ONE document via
 * match_student_document_chunks() (pgvector cosine distance). Ownership of
 * documentId must already be verified by the caller (service client +
 * .eq("user_id", user.id)) before this is called — this function trusts the
 * documentId it's given.
 */
export async function retrieveDocumentContext(
  question: string,
  documentId: string,
  matchCount = 6
): Promise<RetrievedDocumentChunk[]> {
  const embedding = await embedText(question, "RETRIEVAL_QUERY");
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("match_student_document_chunks", {
    query_embedding: embedding,
    match_document_id: documentId,
    match_count: matchCount,
  });
  if (error) throw new Error(`Document retrieval failed: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    chunkId: row.chunk_id,
    content: row.content,
    similarity: row.similarity,
  }));
}

const studySummarySchema = z.object({
  mainIdea: z.string().min(10).max(600),
  keyPoints: z.array(z.string().min(3).max(300)).min(2).max(6),
  workedExample: z.string().max(600).optional(),
});
export type StudySummary = z.infer<typeof studySummarySchema>;

// gemini-3.5-flash has a large context window, but we still cap what we send
// per call to keep latency/cost sane and avoid truncation surprises. A PDF
// longer than DIRECT_SUMMARY_CHAR_LIMIT is summarized in segments (map), then
// the segment summaries are combined into one final summary (reduce) — so a
// 40-page exam prep document gets covered end-to-end instead of only its
// first ~8 pages.
const DIRECT_SUMMARY_CHAR_LIMIT = 60_000;
const SEGMENT_CHAR_SIZE = 50_000;
const MAX_SEGMENTS = 20; // ~1M chars ceiling; degrades gracefully beyond that instead of erroring

function splitIntoSegments(raw: string, segmentSize: number): string[] {
  const paragraphs = raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const segments: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= segmentSize) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) segments.push(current);
    if (paragraph.length <= segmentSize) {
      current = paragraph;
    } else {
      for (let start = 0; start < paragraph.length; start += segmentSize) {
        segments.push(paragraph.slice(start, start + segmentSize));
      }
      current = "";
    }
  }
  if (current) segments.push(current);
  return segments;
}

async function callGeminiJson(systemText: string, userText: string, maxOutputTokens: number): Promise<unknown> {
  const response = await fetchWithTimeout(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens, responseMimeType: "application/json" },
      }),
    }
  );
  if (!response.ok) throw new Error(`Gemini summary failed: ${response.status}`);
  const result = await readJsonWithLimit<Record<string, any>>(response, 2 * 1024 * 1024);
  const raw: string = result.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("SUMMARY_INVALID_JSON");
  }
}

/**
 * Condenses one segment of a long document into a short plain-text digest
 * (a few sentences), grounded strictly in that segment. These digests are
 * later combined and re-summarized into the final structured StudySummary.
 */
async function summarizeSegment(segment: string, index: number, total: number, locale: "ar" | "fr"): Promise<string> {
  const prompt =
    locale === "ar"
      ? `هذا هو الجزء ${index + 1} من ${total} من مستند دراسي. لخّصه في 3 إلى 5 جمل، مقتصراً حصراً على ما ورد فيه. أعد JSON بالشكل {"digest":"..."}. النص:\n\n${segment}`
      : `Voici la partie ${index + 1}/${total} d'un document pédagogique. Résume-la en 3 à 5 phrases, en te limitant strictement à ce qu'elle contient. Réponds en JSON au format {"digest":"..."}. Texte :\n\n${segment}`;
  const json = await callGeminiJson(
    "Tu condenses fidèlement un extrait de document. N'invente rien. Réponds uniquement en JSON valide.",
    prompt,
    400
  );
  const parsed = z.object({ digest: z.string().min(1) }).safeParse(json);
  if (!parsed.success) throw new Error("SUMMARY_SEGMENT_FAILED_VALIDATION");
  return parsed.data.digest;
}

/**
 * Generates a structured summary of an uploaded document/transcript, grounded
 * strictly in its own text (not the curriculum KB). Used right after
 * ingestion so the student sees a real summary instead of the previous
 * hardcoded "Les limites d'une fonction" placeholder.
 *
 * Documents that fit within DIRECT_SUMMARY_CHAR_LIMIT are summarized in one
 * call. Longer documents are summarized segment-by-segment (map), then those
 * segment digests are combined into one final structured summary (reduce),
 * so the whole document is covered instead of just its opening pages.
 */
export async function generateStudySummary(rawText: string, locale: "ar" | "fr" = "fr"): Promise<StudySummary> {
  let sourceText: string;

  if (rawText.length <= DIRECT_SUMMARY_CHAR_LIMIT) {
    sourceText = rawText;
  } else {
    const segments = splitIntoSegments(rawText, SEGMENT_CHAR_SIZE).slice(0, MAX_SEGMENTS);
    const digests: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      digests.push(await summarizeSegment(segments[i], i, segments.length, locale));
    }
    sourceText = digests.map((d, i) => `[${locale === "ar" ? "جزء" : "Partie"} ${i + 1}] ${d}`).join("\n\n");
  }

  const prompt =
    locale === "ar"
      ? `لخّص هذا المحتوى الدراسي بالاعتماد حصراً على النص المرفق، دون إضافة أي معلومة غير موجودة فيه. أعد JSON فقط بالشكل {"mainIdea":"...","keyPoints":["...","..."],"workedExample":"..."} (workedExample اختياري، أدرجه فقط إذا كان النص يحتوي فعلاً على مثال محلول). النص:\n\n${sourceText}`
      : `Résume ce contenu pédagogique en te basant strictement sur le texte fourni ci-dessous, sans ajouter d'information absente. Réponds uniquement en JSON au format {"mainIdea":"...","keyPoints":["...","..."],"workedExample":"..."} (workedExample est optionnel, à inclure seulement si le texte contient réellement un exemple résolu). Texte :\n\n${sourceText}`;

  const json = await callGeminiJson(
    "Tu résumes fidèlement un support fourni par l'utilisateur. N'invente jamais un fait absent du texte. Réponds uniquement en JSON valide.",
    prompt,
    1200
  );
  const parsed = studySummarySchema.safeParse(json);
  if (!parsed.success) throw new Error("SUMMARY_FAILED_VALIDATION");
  return parsed.data;
}
