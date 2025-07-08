import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { writeDocumentContentBySlug } from "../db/docs.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

function importRoute(db: DatabaseSync): Route {
  return async (req: Request) => {
    const bodySchema = z.object({
      slug: z.string(),
      content: z.string(),
    });
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response("Invalid payload", { status: 400 });
    }
    writeDocumentContentBySlug(db, parsed.data.slug, parsed.data.content);
    return new Response("Ok", { status: 200 });
  };
}

export { importRoute };
