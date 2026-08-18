import { createServiceClient } from "./supabase-server";

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
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    throw new Error(`Gemini embedding failed: ${response.status} ${await response.text()}`);
  }
  const data = (await response.json()) as { embedding: { values: number[] } };
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
