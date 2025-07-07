import { DatabaseSync } from "node:sqlite";

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

function migrateSchema(db: DatabaseSync) {
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

function migrateDocuments(db: DatabaseSync) {
  const defaultDocuments = [
    { slug: "training-program", content: "" },
    { slug: "known-ingredients", content: "" },
    { slug: "log", content: "" },
  ];

  for (const document of defaultDocuments) {
    const existing = db.prepare(`SELECT slug FROM documents WHERE slug = ?`).get(document.slug);
    if (!existing) {
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO documents (slug, content, created_at, updated_at) VALUES (?, ?, ?, ?)`
      ).run(document.slug, document.content, now, now);
    }
  }
}

export { migrateDocuments, migrateSchema };
