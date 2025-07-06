import { DatabaseSync } from "node:sqlite";
import z from "zod";

const db = new DatabaseSync("test.db");

const MIGRATIONS: { version: number; migration: string }[] = [
  {
    version: 1,
    migration: `
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
    `,
  },
];

function migrate() {
  db.prepare(`CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY)`).run();
  const currentVersionResult = db
    .prepare(`SELECT version FROM migrations ORDER BY version DESC LIMIT 1`)
    .get();
  const currentVersion = (currentVersionResult as { version?: number } | undefined)?.version || 0;
  for (const { version, migration } of MIGRATIONS) {
    if (version > currentVersion) {
      db.exec(migration);
      db.prepare(`INSERT INTO migrations (version) VALUES (?)`).run(version);
    }
  }
}

// -------------------------------------------------------------------------------------------------

const documentContentSchema = z.object({
  content: z.string(),
});

// -------------------------------------------------------------------------------------------------

function readDocumentContentBySlug(slug: string): string {
  const result = db.prepare(`SELECT content FROM documents WHERE slug = ?`).get(slug);
  if (!result) {
    return "";
  }
  const parsed = documentContentSchema.safeParse(result);
  if (!parsed.success) {
    throw new Error(`Invalid document data for slug: ${slug}`);
  }
  return parsed.data.content;
}

function writeDocumentContentBySlug(slug: string, content: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `
    INSERT INTO documents (slug, content, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (slug) DO UPDATE SET content = ?, updated_at = ?
    `
  ).run(slug, content, now, now, content, now);
}

export { db, migrate, readDocumentContentBySlug, writeDocumentContentBySlug };
