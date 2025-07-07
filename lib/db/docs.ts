import { DatabaseSync } from "node:sqlite";
import z from "zod";

function readDocumentContentBySlug(db: DatabaseSync, slug: string): string {
  const result = db.prepare(`SELECT content FROM documents WHERE slug = ?`).get(slug);
  if (!result) {
    return "";
  }
  const parsed = z.object({ content: z.string().nullable() }).safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid document data for slug: ${slug}`);
  }
  return parsed.data.content ?? "";
}

function writeDocumentContentBySlug(
  db: DatabaseSync,
  slug: string,
  content: string,
  now = new Date()
): void {
  db.prepare(
    `
    INSERT INTO documents (slug, content, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET content = ?, updated_at = ?
    `
  ).run(slug, content, now.toISOString(), now.toISOString(), content, now.toISOString());
}

export { readDocumentContentBySlug, writeDocumentContentBySlug };
