import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug } from "../db/docs.ts";

const knownDocuments = {
  config: "The user's configuration settings, such as goals, preferences, etc.",
  log: "An append-only log of user's data, such as weight, food intake, etc.",
  "training-program": "The user's current training program.",
  "known-ingredients": "A list of known ingredients and their nutritional values.",
};

const description = `
Read a document's contents by its slug. Available documents:
${Object.entries(knownDocuments)
  .map(([slug, description]) => `- \`${slug}\`: ${description}`)
  .join("\n")}
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
    let content = readDocumentContentBySlug(db, parsed.data.slug);

    if (
      parsed.data.slug === "config" ||
      parsed.data.slug === "log" ||
      parsed.data.slug === "known-ingredients"
    ) {
      content = JSON.stringify(JSON.parse(content || "{}"), null, 2);
    }

    return content;
  }

  return `Error: Unknown document slug: ${parsed.data.slug}`;
}

export { executeReadDocumentTool, readDocumentTool };
