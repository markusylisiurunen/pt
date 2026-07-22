import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

function userRoute(db: DatabaseSync, name: string): Route {
  return (req: Request) => {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const configDoc = readDocumentContentBySlug(db, "config") || "{}";
    const config = Config.safeParse(JSON.parse(configDoc));
    if (!config.success) {
      return new Response("Invalid config document", { status: 500 });
    }
    return Response.json({ name, themeHue: config.data.themeHue });
  };
}

export { userRoute };
