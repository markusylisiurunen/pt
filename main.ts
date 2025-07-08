import { serveDir } from "@std/http";
import { migrateDocuments, migrateSchema } from "./lib/db/migrate.ts";

const db = new DatabaseSync("test.db");

migrateSchema(db);
migrateDocuments(db);

import { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { Agent } from "./lib/agent/agent.ts";
import { readDocumentContentBySlug } from "./lib/db/docs.ts";
import { Config } from "./lib/entities/config.ts";
import { Log } from "./lib/entities/log.ts";

const PASSWORD = Deno.env.get("PASSWORD") || crypto.randomUUID();

const agent = new Agent(Deno.env.get("ANTHROPIC_API_KEY") ?? "", db);

const configPattern = new URLPattern({ pathname: "/api/config" });
const chatPattern = new URLPattern({ pathname: "/api/chats/:id" });

function handleConfig(req: Request): Response {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const config = readDocumentContentBySlug(db, "config") || "{}";
  const parsedConfig = Config.safeParse(JSON.parse(config));
  if (!parsedConfig.success) {
    return new Response("Invalid config", { status: 500 });
  }

  const log = readDocumentContentBySlug(db, "log") || "{}";
  const parsedLog = Log.safeParse(JSON.parse(log));
  if (!parsedLog.success) {
    return new Response("Invalid log", { status: 500 });
  }

  const nowDateStr = new Date().toISOString().split("T")[0];

  const caloriesToday = parsedLog.data.entries.reduce((sum, i) => {
    if (i.kind !== "food") return sum;
    const dateStr = new Date(i.ts).toISOString().split("T")[0];
    if (dateStr !== nowDateStr) return sum;
    return sum + (i.kcal ?? 0);
  }, 0);
  const proteinToday = parsedLog.data.entries.reduce((sum, i) => {
    if (i.kind !== "food") return sum;
    const dateStr = new Date(i.ts).toISOString().split("T")[0];
    if (dateStr !== nowDateStr) return sum;
    return sum + (i.protein ?? 0);
  }, 0);

  const weightHistoryMinDate = new Date();
  weightHistoryMinDate.setDate(weightHistoryMinDate.getDate() - 6 * 30);

  const result = {
    config: parsedConfig.data,
    foodIntakeToday: {
      kcal: caloriesToday,
      protein: proteinToday,
    },
    weightHistory: parsedLog.data.entries
      .filter((i) => i.kind === "weight")
      .filter((i) => new Date(i.ts) >= weightHistoryMinDate)
      .map((i) => ({ date: i.ts, weight: i.weight })),
  };

  return new Response(JSON.stringify(result), {
    headers: {
      "content-type": "application/json",
    },
  });
}

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

    if (!url.pathname.startsWith("/api/")) {
      return serveDir(req, { fsRoot: "./web/dist" });
    }

    const auth = req.headers.get("authorization");
    if (!auth || auth !== `Bearer ${PASSWORD}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const configMatch = configPattern.exec(url);
    if (configMatch) {
      return handleConfig(req);
    }

    const chatMatch = chatPattern.exec(url);
    if (chatMatch) {
      const id = chatMatch.pathname.groups["id"] as string;
      return await handleChat(req, id);
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies Deno.ServeDefaultExport;
