import { strict as assert } from "node:assert";
import { readAssistantResponse } from "../lib/assistant-stream";

const encoder = new TextEncoder();
const chunks = [
  `data: {"type":"delta","text":"مرحبا "}\n\n`,
  `data: {"type":"delta","text":"بكم"}\n\n`,
  `data: {"type":"meta","grounded":true}\n\n`,
  `data: {"type":"done"}\n\n`,
];

const response = new Response(new ReadableStream<Uint8Array>({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
    controller.close();
  },
}), { headers: { "content-type": "text/event-stream" } });

async function main() {
  const received: string[] = [];
  const result = await readAssistantResponse(response, text => received.push(text));
  assert.equal(received.join(""), "مرحبا بكم");
  assert.equal(result.answer, "مرحبا بكم");
  assert.equal(result.grounded, true);
  console.log("assistant stream parser: ok");
}

void main();
