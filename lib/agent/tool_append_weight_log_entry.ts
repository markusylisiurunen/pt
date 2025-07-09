import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Log } from "../entities/log.ts";

const description = `
Append a weight log entry to the user's log. Leave the 'date' field empty unless the user explicitly specifies a date.
`.trim();

// deno-fmt-ignore
function appendWeightLogEntryTool(): Anthropic.Tool {
  return {
    name: "AppendWeightLogEntry",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Optional date for the log entry. If specified, must be in YYYY-MM-DD format (e.g., '2023-10-01'). Defaults to current time.",
        },
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
    date: z.string().optional(),
    weight: z.number(),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }
  if (parsed.data.date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(parsed.data.date)) {
      return "Error: Date must be in YYYY-MM-DD format.";
    }
  }
  if (parsed.data.weight <= 0) {
    return "Error: Weight must be a positive number.";
  }

  const content = readDocumentContentBySlug(db, "log");
  const log = Log.safeParse(JSON.parse(content || "{}"));
  if (!log.success) {
    return "Error: Failed to parse log document.";
  }

  const id = crypto.randomUUID();

  log.data.entries.push({
    id: id,
    ts: parsed.data.date ? new Date(parsed.data.date).toISOString() : new Date().toISOString(),
    kind: "weight",
    weight: parsed.data.weight,
  });

  log.data.entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  writeDocumentContentBySlug(db, "log", JSON.stringify(log.data));

  return `Weight log entry recorded (id: ${id}).`;
}

export { appendWeightLogEntryTool, executeAppendWeightLogEntryTool };
