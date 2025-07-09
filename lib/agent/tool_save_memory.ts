import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";

const description = `
Save a memory entry to the user's configuration. This automatically adds the current date as a prefix and stores the entry in the user's memory list for future reference.

Use this tool only when the user explicitly asks to save a memory. The memories should be written from the user's perspective, in a concise and factual manner in the same language as the user speaks.

Examples of valid memory entries:
- "I prefer to eat vegetarian meals."
- "Ensisijainen tavoitteeni on laihduttaa, mutta minulle on myös tärkeää ylläpitää lihasmassaa."

The tool will automatically format the stored memory as "YYYY-MM-DD: [memory content]". You should never include the date in the memory content itself, as it will be added automatically.
`.trim();

// deno-fmt-ignore
function saveMemoryTool(): Anthropic.Tool {
  return {
    name: "SaveMemory",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        memory: {
          type: "string",
          description: "The memory to save. Should be a concise, factual statement about the user.",
        },
      },
      required: ["memory"],
    },
  };
}

function executeSaveMemoryTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    memory: z.string().min(1),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  const content = readDocumentContentBySlug(db, "config");
  const config = Config.safeParse(JSON.parse(content || "{}"));
  if (!config.success) {
    return "Error: Failed to parse config document.";
  }

  const dateStr = new Date().toISOString().split("T")[0];
  config.data.memoryEntries.push(`${dateStr}: ${parsed.data.memory}`);

  writeDocumentContentBySlug(db, "config", JSON.stringify(config.data));

  return `Memory saved.`;
}

export { executeSaveMemoryTool, saveMemoryTool };
