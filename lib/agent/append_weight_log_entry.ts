import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Log } from "../entities/log.ts";

const description = `
Append a weight log entry to the user's log.
`.trim();

function appendWeightLogEntryTool(): Anthropic.Tool {
  return {
    name: "AppendWeightLogEntry",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        weight: {
          type: "number",
          description: "The weight to log in kilograms.",
        },
      },
      required: ["weight"],
    },
  };
}

function executeAppendWeightLogEntryTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    weight: z.number(),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }
  if (parsed.data.weight <= 0) {
    return "Error: Weight must be a positive number.";
  }

  const content = readDocumentContentBySlug(db, "log");
  const log = Log.safeParse(JSON.parse(content || "{}"));
  if (!log.success) {
    return "Error: Failed to parse log document.";
  }

  log.data.entries.push({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    kind: "weight",
    weight: parsed.data.weight,
  });

  writeDocumentContentBySlug(db, "log", JSON.stringify(log.data));

  return "Weight log entry recorded.";
}

export { appendWeightLogEntryTool, executeAppendWeightLogEntryTool };
