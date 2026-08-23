export type AssistantStreamMeta = {
  grounded?: boolean;
  sources?: { title: string; similarity: number }[];
};

type AssistantEvent =
  | { type: "delta"; text?: string }
  | ({ type: "meta" } & AssistantStreamMeta)
  | { type: "done" }
  | { type: "error"; error?: string };

export async function readAssistantResponse(
  response: Response,
  onDelta: (text: string) => void
): Promise<AssistantStreamMeta & { answer: string }> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.body || !contentType.includes("text/event-stream")) {
    const data = (await response.json()) as { answer?: string; error?: unknown; grounded?: boolean; sources?: AssistantStreamMeta["sources"] };
    if (!response.ok) {
      const error = typeof data.error === "string" ? data.error : "Impossible de générer une réponse.";
      throw new Error(error);
    }
    const answer = data.answer ?? "";
    if (answer) onDelta(answer);
    return { answer, grounded: data.grounded, sources: data.sources };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let meta: AssistantStreamMeta = {};

  const consume = (rawEvent: string) => {
    const dataLine = rawEvent.split("\n").find(line => line.startsWith("data:"));
    if (!dataLine) return false;
    const payload = dataLine.slice(5).trim();
    if (!payload || payload === "[DONE]") return false;
    const event = JSON.parse(payload) as AssistantEvent;
    if (event.type === "delta") {
      const text = event.text ?? "";
      answer += text;
      onDelta(text);
    } else if (event.type === "meta") {
      meta = { grounded: event.grounded, sources: event.sources };
    } else if (event.type === "error") {
      throw new Error(event.error ?? "تعذر بث الإجابة.");
    } else if (event.type === "done") {
      return true;
    }
    return false;
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) if (consume(event)) return { answer, ...meta };
    }
    if (buffer.trim()) consume(buffer);
  } finally {
    reader.releaseLock();
  }

  return { answer, ...meta };
}
