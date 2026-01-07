import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { writeDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";
import { KnownIngredients } from "../entities/ingredient.ts";
import { Log } from "../entities/log.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

const allowedSlugs = new Set(["config", "log", "known-ingredients", "training-program"]);

function importRoute(db: DatabaseSync): Route {
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

    const bodySchema = z.object({
      slug: z.string(),
      content: z.string(),
    });
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response("Invalid payload", { status: 400 });
    }

    if (!allowedSlugs.has(parsed.data.slug)) {
      return new Response("Invalid payload", { status: 400 });
    }

    if (parsed.data.slug === "config") {
      try {
        const doc = JSON.parse(parsed.data.content);
        const config = Config.safeParse(doc);
        if (!config.success) {
          return new Response("Invalid payload", { status: 400 });
        }
      } catch {
        return new Response("Invalid payload", { status: 400 });
      }
    }

    if (parsed.data.slug === "log") {
      try {
        const doc = JSON.parse(parsed.data.content);
        const log = Log.safeParse(doc);
        if (!log.success) {
          return new Response("Invalid payload", { status: 400 });
        }
      } catch {
        return new Response("Invalid payload", { status: 400 });
      }
    }

    if (parsed.data.slug === "known-ingredients") {
      try {
        const doc = JSON.parse(parsed.data.content);
        const knownIngredients = KnownIngredients.safeParse(doc);
        if (!knownIngredients.success) {
          return new Response("Invalid payload", { status: 400 });
        }
      } catch {
        return new Response("Invalid payload", { status: 400 });
      }
    }

    writeDocumentContentBySlug(db, parsed.data.slug, parsed.data.content);
    return new Response("Ok", { status: 200 });
  };
}

export { importRoute };
