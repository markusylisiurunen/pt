import { migrateDocuments, migrateSchema } from "./lib/db/migrate.ts";

const db = new DatabaseSync("test.db");

migrateSchema(db);
migrateDocuments(db);

import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Agent } from "./lib/agent/agent.ts";

const agent = new Agent(Deno.env.get("ANTHROPIC_API_KEY") ?? "", db);

const chatPattern = new URLPattern({ pathname: "/api/chats/:id" });

async function handleChat(req: Request, id: string): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const bodySchema = z.object({
    content: z.string(),
  });
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return new Response("Invalid request body", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of agent.send(id, parsed.data.content)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        }
        controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
    },
  });
}

export default {
  async fetch(req) {
    const url = new URL(req.url);

    const chatMatch = chatPattern.exec(url);
    if (chatMatch) {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const id = chatMatch.pathname.groups["id"] as string;
      return await handleChat(req, id);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies Deno.ServeDefaultExport;
