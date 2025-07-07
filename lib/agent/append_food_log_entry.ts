import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Log } from "../entities/log.ts";

const description = `
Append a food intake log entry to the user's log. You must think hard about the food intake and its nutritional values before logging it. If the user does not provide enough information, you should ask for more details before logging the entry.
`.trim();

function appendFoodLogEntryTool(): Anthropic.Tool {
  return {
    name: "AppendFoodLogEntry",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description:
            "A description of the food consumed. Examples: 'Kaksi siivua ruisleipää, 1 dl maitoa, 1 banaani', 'Pehmeää raejuustoa ja bataattia' or 'Oatmeal with berries and nuts'.",
        },
        notes: {
          type: "string",
          description:
            "Any additional notes about the food intake. This is optional and should only be used when asked to include additional information.",
        },
        kcal: {
          type: "number",
          description: "The best-effort number of calories in the food intake entry.",
        },
        protein: {
          type: "number",
          description: "The best-effort amount of protein in the food intake entry (in grams).",
        },
        carbs: {
          type: "number",
          description:
            "The best-effort amount of carbohydrates in the food intake entry (in grams).",
        },
        fat: {
          type: "number",
          description: "The best-effort amount of fat in the food intake entry (in grams).",
        },
      },
      required: ["description"],
    },
  };
}

function executeAppendFoodLogEntryTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    description: z.string(),
    notes: z.string().optional(),
    kcal: z.number().optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fat: z.number().optional(),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }
  if (
    (parsed.data.kcal ?? 1) < 0 ||
    (parsed.data.protein ?? 1) < 0 ||
    (parsed.data.carbs ?? 1) < 0 ||
    (parsed.data.fat ?? 1) < 0
  ) {
    return "Error: Nutritional values must be non-negative.";
  }

  const content = readDocumentContentBySlug(db, "log");
  const log = Log.safeParse(JSON.parse(content || "{}"));
  if (!log.success) {
    return "Error: Failed to parse log document.";
  }

  log.data.entries.push({
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    kind: "food",
    description: parsed.data.description,
    notes: parsed.data.notes,
    kcal: parsed.data.kcal,
    protein: parsed.data.protein,
    carbs: parsed.data.carbs,
    fat: parsed.data.fat,
  });

  writeDocumentContentBySlug(db, "log", JSON.stringify(log.data));

  return "Food log entry recorded.";
}

export { appendFoodLogEntryTool, executeAppendFoodLogEntryTool };
