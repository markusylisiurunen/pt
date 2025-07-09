import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { Log } from "../entities/log.ts";

const description = `
Append a food intake log entry to the user's log. Leave the 'date' field empty unless the user explicitly specifies a date.

## One entry or multiple entries?

In general, you should prefer logging a single entry for the entire food intake, even if it contains multiple items. This is because the user is likely to consume these items together in one sitting, and it makes more sense to log them as a single entry. Often, the user simply lists ingredients they have used in a meal, and it's reasonable to log them as a single entry.

If the user explicitly asks to log each food item (or some items) separately, you can do that, but it's not the default behavior.

## How to estimate nutritional values

1. Always prefer using the user's 'known-ingredients' list above all else. It's provided by the user, so it's the most accurate source of information.
2. If the 'known-ingredients' list doesn't contain the food item, you may use the Fineli database to find the nutritional values.
3. If the food item isn't found in the Fineli database, use common sense and general knowledge about the food item to estimate the nutritional values.

IMPORTANT: You MUST always read the 'known-ingredients' list before logging any food consumption. Steps 2 and 3 can be skipped if you have enough information from the 'known-ingredients' list, or if it's a very common food item that you can reasonably estimate without looking it up. Fineli lookups are somewhat expensive, so use them only when necessary and when the food item contributes significantly to the entry's nutritional values.

## When to ask for confirmation from the user

If after your best effort to estimate the nutritional values you're still unsure about the values, or if the user has provided insufficient information about the food item, you should ask for confirmation or more details from the user before logging the entry. A good rule of thumb is to ask for confirmation if you're not at least 90% confident about the nutritional values. Being overly cautious isn't good either — it's frustrating for the user if you ask for confirmation too often. Use your best judgment.

## Report what you logged

After logging the entry, you should provide a short and concise natural language/conversational summary of what you logged, including the nutritional values. Mistakes are always possible, so it's better to be transparent and give the user a chance to correct any mistakes.
`.trim();

// deno-fmt-ignore
function appendFoodLogEntryTool(): Anthropic.Tool {
  return {
    name: "AppendFoodLogEntry",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Optional date for the log entry. If specified, must be in YYYY-MM-DD format (e.g., '2023-10-01'). Defaults to current time.",
        },
        description: {
          type: "string",
          description: "Description of the consumed food. Examples: 'Kaksi siivua ruisleipää, 1 dl maitoa, 1 banaani' or 'Kuppi kahvia ja kanelipulla'.",
        },
        notes: {
          type: "string",
          description: "Optional additional notes about the consumed food. Only include when user asks to include additional information.",
        },
        kcal: {
          type: "number",
          description: "Best-effort estimate of calories in the consumed food.",
        },
        protein: {
          type: "number",
          description: "Best-effort estimate of protein in the consumed food (in grams).",
        },
      },
      required: ["description", "kcal", "protein"],
    },
  };
}

function executeAppendFoodLogEntryTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    date: z.string().optional(),
    description: z.string(),
    notes: z.string().optional(),
    kcal: z.number().min(0).optional(),
    protein: z.number().min(0).optional(),
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

  const content = readDocumentContentBySlug(db, "log");
  const log = Log.safeParse(JSON.parse(content || "{}"));
  if (!log.success) {
    return "Error: Failed to parse log document.";
  }

  const id = crypto.randomUUID();

  log.data.entries.push({
    id: id,
    ts: parsed.data.date ? new Date(parsed.data.date).toISOString() : new Date().toISOString(),
    kind: "food",
    description: parsed.data.description,
    notes: parsed.data.notes,
    kcal: parsed.data.kcal,
    protein: parsed.data.protein,
  });

  log.data.entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  writeDocumentContentBySlug(db, "log", JSON.stringify(log.data));

  return `Food log entry recorded (id: ${id}).`;
}

export { appendFoodLogEntryTool, executeAppendFoodLogEntryTool };
