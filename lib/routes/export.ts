import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

const exportScript = `
const documents = {{documents}};
for (const i of documents) {
  await Deno.writeTextFile(\`\${i.slug}.txt\`, i.content);
}
await Deno.writeTextFile("import.js", {{importScript}}.script);
`.trim();

const importScript = `
const slugs = {{slugs}};
for (const slug of slugs) {
  const content = await Deno.readTextFile(\`\${slug}.txt\`);
  const response = await fetch(\`{{protocol}}://{{host}}/api/import\`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer {{password}}',
    },
    body: JSON.stringify({ slug, content }),
  });
  if (response.ok) {
    console.log(\`Successfully imported "\${slug}"\`);
  } else {
    console.error(\`Failed to import "\${slug}": \${response.status} \${response.statusText}\`);
  }
}
`.trim();

function exportRoute(db: DatabaseSync, password: string): Route {
  return (req: Request) => {
    const slugs = ["config", "log", "known-ingredients", "training-program"];
    const documents = slugs.map((slug) => {
      const content = readDocumentContentBySlug(db, slug);
      return { slug, content };
    });
    const importScriptContent = importScript
      .replace("{{slugs}}", JSON.stringify(slugs))
      .replace("{{protocol}}", new URL(req.url).protocol.includes("https") ? "https" : "http")
      .replace("{{host}}", new URL(req.url).host)
      .replace("{{password}}", password);
    const exportScriptContent = exportScript
      .replace("{{documents}}", JSON.stringify(documents))
      .replace("{{importScript}}", JSON.stringify({ script: importScriptContent }));
    return new Response(exportScriptContent, { status: 200 });
  };
}

export { exportRoute };
