import { DatabaseSync } from "node:sqlite";
import { migrateDocuments, migrateSchema } from "./lib/db/migrate.ts";

const db = new DatabaseSync(`${Deno.env.get("DATA_FOLDER") || "."}/data.db`);

migrateSchema(db);
migrateDocuments(db);

import { serveDir } from "@std/http";
import { Agent } from "./lib/agent/agent.ts";
import { chatRoute } from "./lib/routes/chat.ts";
import { configRoute } from "./lib/routes/config.ts";
import { exportRoute } from "./lib/routes/export.ts";
import { importRoute } from "./lib/routes/import.ts";
import { transcribeRoute } from "./lib/routes/transcribe.ts";

const password = Deno.env.get("PASSWORD") || crypto.randomUUID();
const agent = new Agent(Deno.env.get("ANTHROPIC_API_KEY") ?? "", db);

const chatPattern = new URLPattern({ pathname: "/api/chats/:id" });
const configPattern = new URLPattern({ pathname: "/api/config" });
const exportPattern = new URLPattern({ pathname: "/api/export" });
const importPattern = new URLPattern({ pathname: "/api/import" });
const transcribePattern = new URLPattern({ pathname: "/api/transcribe" });

export default {
  async fetch(req) {
    const url = new URL(req.url);

    if (!url.pathname.startsWith("/api/")) {
      const response = await serveDir(req, { fsRoot: "./web/dist" });
      if (response.status === 404 && !url.pathname.includes(".")) {
        return serveDir(new Request(new URL("/", req.url)), { fsRoot: "./web/dist" });
      }
      return response;
    }

    const auth = req.headers.get("authorization");
    if (!auth || auth !== `Bearer ${password}`) {
      return new Response("Unauthorized", { status: 401 });
    }

    const chatMatch = chatPattern.exec(url);
    if (chatMatch) return chatRoute(agent, chatMatch.pathname.groups["id"] ?? "")(req);

    const configMatch = configPattern.exec(url);
    if (configMatch) return configRoute(db)(req);

    const exportMatch = exportPattern.exec(url);
    if (exportMatch) return exportRoute(db, password)(req);

    const importMatch = importPattern.exec(url);
    if (importMatch) return importRoute(db)(req);

    const transcribeMatch = transcribePattern.exec(url);
    if (transcribeMatch) return transcribeRoute(Deno.env.get("GEMINI_API_KEY") ?? "")(req);

    return new Response("Not found", { status: 404 });
  },
} satisfies Deno.ServeDefaultExport;
