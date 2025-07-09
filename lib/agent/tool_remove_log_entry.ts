import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Log } from "../entities/log.ts";

const description = `
Remove a log entry from the user's log by its ID. This can be used to remove, for example, incorrectly logged food intake entries or weight measurements.
`.trim();

// deno-fmt-ignore
function removeLogEntryTool(): Anthropic.Tool {
  return {
    name: "RemoveLogEntry",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the log entry to remove.",
        },
      },
      required: ["id"],
    },
  };
}

function executeRemoveLogEntryTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    id: z.string(),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  const content = readDocumentContentBySlug(db, "log");
  const log = Log.safeParse(JSON.parse(content || "{}"));
  if (!log.success) {
    return "Error: Failed to parse log document.";
  }

  const entryIndex = log.data.entries.findIndex((entry) => entry.id === parsed.data.id);
  if (entryIndex === -1) {
    return `Error: Log entry with ID ${parsed.data.id} not found.`;
  }

  const removedEntry = log.data.entries[entryIndex];
  log.data.entries.splice(entryIndex, 1);

  writeDocumentContentBySlug(db, "log", JSON.stringify(log.data));

  return `Log entry removed (id: ${parsed.data.id}, type: ${removedEntry.kind}).`;
}

export { executeRemoveLogEntryTool, removeLogEntryTool };
