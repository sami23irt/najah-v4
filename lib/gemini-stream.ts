type StreamMetadata = Record<string, unknown>;

type GeminiStreamOptions = {
  systemInstruction: string;
  prompt: string;
  maxOutputTokens: number;
  metadata?: StreamMetadata;
};

type GeminiChunk = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

const encoder = new TextEncoder();

function sse(data: Record<string, unknown>) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function words(text: string) {
  return text.match(/\S+\s*/g) ?? [text];
}

function textFromChunk(chunk: GeminiChunk) {
  return chunk.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("") ?? "";
}

export async function createGeminiStreamResponse({
  systemInstruction,
  prompt,
  maxOutputTokens,
  metadata = {},
}: GeminiStreamOptions): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: "خدمة الذكاء الاصطناعي غير مهيأة حالياً." }, { status: 503 });

  const abortController = new AbortController();
  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: abortController.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens },
      }),
    }
  );

  if (!upstream.ok || !upstream.body) {
    return Response.json({ error: "تعذر توليد الإجابة حالياً." }, { status: 502 });
  }

  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let closed = false;

      const emitChunk = async (rawEvent: string) => {
        const dataLine = rawEvent
          .split("\n")
          .find(line => line.startsWith("data:"));
        if (!dataLine) return;
        const payload = dataLine.slice(5).trim();
        if (!payload || payload === "[DONE]") return;

        try {
          const text = textFromChunk(JSON.parse(payload) as GeminiChunk);
          for (const token of words(text)) {
            if (closed || cancelled) return;
            controller.enqueue(sse({ type: "delta", text: token }));
            await new Promise(resolve => setTimeout(resolve, 8));
          }
        } catch {
          // Ignore keep-alive or malformed upstream events and continue reading.
        }
      };

      try {
        while (!closed && !cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const event of events) await emitChunk(event);
        }
        if (buffer.trim()) await emitChunk(buffer);
        if (!closed && !cancelled) {
          controller.enqueue(sse({ type: "meta", ...metadata }));
          controller.enqueue(sse({ type: "done" }));
          controller.close();
        }
      } catch (error) {
        if (!closed && !cancelled) {
          controller.enqueue(sse({ type: "error", error: error instanceof Error ? error.message : "تعذر بث الإجابة." }));
          controller.close();
        }
      } finally {
        reader.releaseLock();
      }

      return undefined;
    },
    cancel() {
      cancelled = true;
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
