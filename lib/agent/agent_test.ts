import Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";
import { migrateDocuments, migrateSchema } from "../db/migrate.ts";
import { Log } from "../entities/log.ts";
import { Agent } from "./agent.ts";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

function modelResponse(blocks: Block[], stopReason = "end_turn") {
  const events: { type: string; [key: string]: unknown }[] = [{
    type: "message_start",
    message: {
      id: "message-id",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5-5",
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 },
    },
  }];
  for (const [index, block] of blocks.entries()) {
    events.push({
      type: "content_block_start",
      index,
      content_block: block.type === "text" ? { type: "text", text: "" } : { ...block, input: {} },
    });
    events.push({
      type: "content_block_delta",
      index,
      delta: block.type === "text"
        ? { type: "text_delta", text: block.text }
        : { type: "input_json_delta", partial_json: JSON.stringify(block.input) },
    });
    events.push({ type: "content_block_stop", index });
  }
  events.push({
    type: "message_delta",
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: 1 },
  });
  events.push({ type: "message_stop" });
  return new Response(
    events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(""),
    {
      headers: { "content-type": "text/event-stream" },
    },
  );
}

function createFixture(respond: (round: number) => Response) {
  const db = new DatabaseSync(":memory:");
  migrateSchema(db);
  migrateDocuments(db);
  const requests: Anthropic.Beta.Messages.MessageCreateParams[] = [];
  const client = new Anthropic({
    apiKey: "test-key",
    maxRetries: 0,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname.startsWith("/v1/models/")) {
        return Response.json({ id: "claude-sonnet-5-5", max_tokens: 65536 });
      }
      requests.push(await request.json());
      return respond(requests.length);
    },
  });
  return { db, requests, agent: new Agent("test-key", db, client) };
}

Deno.test("interrupted tool batches record completed writes and leave remaining writes unexecuted", async () => {
  const { db, agent, requests } = createFixture((round) =>
    round === 1
      ? modelResponse([
        {
          type: "tool_use",
          id: "food",
          name: "AppendFoodLogEntry",
          input: { description: "Lunch", kcal: 500, protein: 40 },
        },
        { type: "tool_use", id: "weight", name: "AppendWeightLogEntry", input: { weight: 75 } },
      ], "tool_use")
      : modelResponse([{ type: "text", text: "The lunch was saved; the weight was not." }])
  );
  try {
    const turn = agent.send("chat", "Log lunch and my weight", []);
    assert.equal((await turn.next()).value?.type, "tool_use");
    assert.equal((await turn.next()).value?.type, "tool_use");
    await turn.return(undefined);

    const log = Log.parse(JSON.parse(readDocumentContentBySlug(db, "log")));
    assert.equal(log.entries.length, 1);
    assert.equal(log.entries[0].kind, "food");
    const row = db.prepare("SELECT messages FROM chats WHERE id = 'chat'").get() as {
      messages: string;
    };
    const history = JSON.parse(row.messages);
    assert.equal(history.at(-2).content[0].is_error, undefined);
    assert.equal(history.at(-2).content[1].is_error, true);

    assert.match(history.at(-1).content[0].text, /no longer active/);
    const recovered = agent.getHistory("chat");
    assert.equal(recovered.active, false);
    assert.equal(
      recovered.messages.find((message) => message.name === "AppendFoodLogEntry")?.status,
      "completed",
    );
    assert.equal(
      recovered.messages.find((message) => message.name === "AppendWeightLogEntry")?.status,
      "not-executed",
    );

    for await (const event of agent.send("chat", "What was saved?", [])) {
      assert.equal(event.type, "content_delta");
    }
    assert.equal(requests[0].model, "claude-sonnet-5-5");
    assert.equal(requests[0].max_tokens, 65536);
    assert.equal(requests[0].output_config?.effort, "medium");
    const context = String(requests[1].messages.at(-1)!.content);
    assert.match(context, /"kcal":500/);
    assert.match(context, /"latestWeight":null/);
    assert.ok(requests[1].messages.length > requests[0].messages.length);
  } finally {
    db.close();
  }
});

Deno.test("mutations roll back when their successful tool result cannot be persisted", async () => {
  const { db, agent } = createFixture((round) =>
    round === 1
      ? modelResponse([{
        type: "tool_use",
        id: "food",
        name: "AppendFoodLogEntry",
        input: { description: "Lunch", kcal: 500, protein: 40 },
      }], "tool_use")
      : modelResponse([{ type: "text", text: "The meal could not be saved." }])
  );
  try {
    db.exec(`
      CREATE TRIGGER reject_success BEFORE UPDATE ON chats
      WHEN NEW.messages LIKE '%"tool_result"%' AND NEW.messages NOT LIKE '%"is_error":true%'
      BEGIN SELECT RAISE(ABORT, 'Cannot persist success'); END;
    `);
    for await (const event of agent.send("chat", "Log lunch", [])) void event;
    assert.equal(Log.parse(JSON.parse(readDocumentContentBySlug(db, "log"))).entries.length, 0);
    const row = db.prepare("SELECT messages FROM chats WHERE id = 'chat'").get() as {
      messages: string;
    };
    const history = JSON.parse(row.messages);
    assert.equal(history[2].content[0].is_error, true);
  } finally {
    db.close();
  }
});

Deno.test("truncated model responses do not execute their tool requests", async () => {
  const { db, agent } = createFixture(() =>
    modelResponse([{
      type: "tool_use",
      id: "food",
      name: "AppendFoodLogEntry",
      input: { description: "Lunch", kcal: 500, protein: 40 },
    }], "max_tokens")
  );
  try {
    const events = [];
    for await (const event of agent.send("chat", "Log lunch", [])) events.push(event);
    assert.equal(Log.parse(JSON.parse(readDocumentContentBySlug(db, "log"))).entries.length, 0);
    assert.ok(
      events.some((event) => event.type === "content_delta" && /incomplete/.test(event.content)),
    );
    const row = db.prepare("SELECT messages FROM chats WHERE id = 'chat'").get() as {
      messages: string;
    };
    assert.ok(
      !JSON.parse(row.messages).at(-1).content.some((block: Block) => block.type === "tool_use"),
    );
  } finally {
    db.close();
  }
});

Deno.test("unfinished requests are closed before a later message, including after a restart", async () => {
  const { db, agent, requests } = createFixture(() =>
    modelResponse([{ type: "text", text: "Hello" }])
  );
  try {
    db.prepare("INSERT INTO chats (id, messages, created_at, updated_at) VALUES (?, ?, ?, ?)")
      .run("chat", JSON.stringify([{ role: "user", content: "Log lunch" }]), "now", "now");
    const history = agent.getHistory("chat");
    assert.equal(history.messages[0].content, "Log lunch");
    assert.match(String(history.messages[1].content), /interrupted/);
    for await (const event of agent.send("chat", "Hello", [])) void event;
    assert.match(JSON.stringify(requests[0].messages[1]), /no longer active/);
    assert.equal(Log.parse(JSON.parse(readDocumentContentBySlug(db, "log"))).entries.length, 0);
  } finally {
    db.close();
  }
});
