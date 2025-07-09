import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug } from "../db/docs.ts";

// deno-fmt-ignore
const knownDocuments: Record<string, string> = {
  "config":            `The user's configuration, includes daily food intake targets, weight goals, and other similar information.`,
  "log":               `An append-only log, including food intake and weight measurements. Use the "Append(.+)LogEntry" tools to add new entries.`,
  "training-program":  `The user's current training program.`,
  "known-ingredients": `A list of user-saved food items and/or ingredients with their nutritional information. You should always prefer these over other sources.`,
};

const description = `
Read a document's contents by its slug. Available documents are:
${
  Object.entries(knownDocuments)
    .map(([slug, desc]) => `- ${slug}: ${desc}`)
    .join("\n")
}
`.trim();

function readDocumentTool(): Anthropic.Tool {
  return {
    name: "ReadDocument",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        slug: {
          type: "string",
          description: "The slug of the document to read.",
          enum: Object.keys(knownDocuments),
        },
      },
      required: ["slug"],
    },
  };
}

function executeReadDocumentTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    slug: z.string(),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  if (parsed.data.slug in knownDocuments) {
    const jsonDocSlugs = ["config", "log", "known-ingredients"];
    const content = readDocumentContentBySlug(db, parsed.data.slug);
    if (content && jsonDocSlugs.includes(parsed.data.slug)) {
      return JSON.stringify(JSON.parse(content), null, 2);
    }
    return content;
  }

  return `Error: Unknown document slug: ${parsed.data.slug}`;
}

export { executeReadDocumentTool, readDocumentTool };
