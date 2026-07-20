import assert from "node:assert/strict";
import { chatRoute } from "./routes/chat.ts";
import {
  type AgentEvent,
  applyAgentEvent,
  type ChatMessage,
  readAgentEvents,
} from "../web/src/routes/chat/chat-events.ts";

function createStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

Deno.test("reads chat events across arbitrary chunk and Unicode boundaries", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"type":"content_delta","content":"Hä"}\n\n' +
      'data: {"type":"tool_use","name":"search_fineli"}\n\n' +
      'data: {"type":"content_delta","content":"mmennys"}\n\n' +
      "data: [DONE]",
  );
  const unicodeIndex = bytes.indexOf(0xc3);
  const chunks = [
    bytes.slice(0, 9),
    bytes.slice(9, unicodeIndex + 1),
    bytes.slice(unicodeIndex + 1, unicodeIndex + 7),
    bytes.slice(unicodeIndex + 7),
  ];

  const events: AgentEvent[] = [];
  for await (const event of readAgentEvents(createStream(chunks))) {
    events.push(event);
  }

  assert.deepEqual(events, [
    { type: "content_delta", content: "Hä" },
    { type: "tool_use", name: "search_fineli" },
    { type: "content_delta", content: "mmennys" },
  ]);
});

Deno.test("rejects chat streams that end without a completion event", async () => {
  const stream = createStream([
    new TextEncoder().encode('data: {"type":"content_delta","content":"Partial"}\n\n'),
  ]);

  await assert.rejects(async () => {
    for await (const event of readAgentEvents(stream)) {
      void event;
    }
  }, /ended unexpectedly/);
});

Deno.test("starts a new assistant segment after a tool event", () => {
  let messages: ChatMessage[] = [
    { role: "user", content: "Search", images: [] },
  ];
  messages = applyAgentEvent(messages, { type: "content_delta", content: "Before" });
  messages = applyAgentEvent(messages, { type: "content_delta", content: " tool" });
  messages = applyAgentEvent(messages, { type: "tool_use", name: "search_fineli" });
  messages = applyAgentEvent(messages, { type: "content_delta", content: "After" });

  assert.deepEqual(messages, [
    { role: "user", content: "Search", images: [] },
    { role: "assistant", content: "Before tool" },
    { role: "tool-use", name: "search_fineli" },
    { role: "assistant", content: "After" },
  ]);
});

Deno.test("rejects malformed chat request JSON", async () => {
  const agent = {
    async *send() {
      yield { type: "content_delta", content: "unused" } as const;
    },
  };
  const response = await chatRoute(agent, "chat-id")(
    new Request("http://localhost/api/chats/chat-id", {
      method: "POST",
      body: "{",
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Invalid payload");
});

Deno.test("frames chat failures as stream events", async () => {
  const agent = {
    async *send() {
      yield { type: "content_delta", content: "Partial" } as const;
      throw new Error("Anthropic unavailable");
    },
  };
  const response = await chatRoute(agent, "chat-id")(
    new Request("http://localhost/api/chats/chat-id", {
      method: "POST",
      body: JSON.stringify({ content: "Hello", images: [] }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-cache");
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  assert.equal(
    await response.text(),
    'data: {"type":"content_delta","content":"Partial"}\n\n' +
      'data: {"type":"error"}\n\n' +
      "data: [DONE]\n\n",
  );
});
