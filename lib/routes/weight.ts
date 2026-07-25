import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Log, WeightLogEntry } from "../entities/log.ts";
import { getDateAtTimeZone } from "../util/datetime.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

function weightRoute(db: DatabaseSync): Route {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }

    const body = z.object({ weight: z.number().positive() }).safeParse(json);
    if (!body.success) {
      return new Response("Invalid payload", { status: 400 });
    }

    const content = readDocumentContentBySlug(db, "log");
    let logJson: unknown;
    try {
      logJson = JSON.parse(content || "{}");
    } catch {
      return new Response("Invalid log document", { status: 500 });
    }
    const log = Log.safeParse(logJson);
    if (!log.success) {
      return new Response("Invalid log document", { status: 500 });
    }

    const entry: WeightLogEntry = {
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      kind: "weight",
      weight: body.data.weight,
    };
    log.data.entries.push(entry);
    log.data.entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    writeDocumentContentBySlug(db, "log", JSON.stringify(log.data));

    return Response.json({
      date: getDateAtTimeZone(entry.ts, "Europe/Helsinki"),
      weight: entry.weight,
    });
  };
}

export { weightRoute };
