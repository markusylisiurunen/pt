import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

function docsRoute(db: DatabaseSync, slug: string): Route {
  return (req: Request) => {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    let content: string;
    switch (slug) {
      case "training-program":
        content = readDocumentContentBySlug(db, "training-program");
        break;
      default:
        return new Response("Not found", { status: 404 });
    }
    return new Response(content || "", {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  };
}

export { docsRoute };
