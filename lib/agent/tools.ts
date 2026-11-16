import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readConfig, readIngredients, readLog } from "../db/agent.ts";
import { writeDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";
import { Ingredient } from "../entities/ingredient.ts";
import { FoodLogEntry, FoodLogIngredient, Log, WeightLogEntry } from "../entities/log.ts";
import { getDateAtTimeZone, getIsoAtStartOfDayAtTimeZone } from "../util/datetime.ts";
import { executePythonTool } from "./tool_execute_python.ts";
import { queryDatabaseTool } from "./tool_query_database.ts";
import { type AgentTool, defineMutationTool } from "./tool.ts";

const dateSchema = z.iso.date().optional().describe(
  "Helsinki calendar date, YYYY-MM-DD. Omit unless the user specifies a date. " +
    "New entries default to now; updates preserve the existing timestamp.",
);

const foodSchema = z.object({
  date: dateSchema,
  description: z.string().min(1).describe("Meal description, including amounts when known."),
  notes: z.string().optional().describe("Additional notes requested by the user."),
  ingredients: z.array(FoodLogIngredient).min(1).optional().describe(
    "Ingredient descriptions (including quantities) and their calorie/protein contributions. " +
      "When provided, the tool calculates the meal totals from these contributions.",
  ),
  kcal: z.number().min(0).optional(),
  protein: z.number().min(0).optional().describe("Protein in grams."),
}).strict().refine(
  (input) => input.ingredients || (input.kcal !== undefined && input.protein !== undefined),
  "Provide ingredients or both kcal and protein.",
);

function foodValues(input: z.infer<typeof foodSchema>) {
  return {
    description: input.description,
    notes: input.notes,
    ingredients: input.ingredients,
    kcal: input.kcal,
    protein: input.protein,
  };
}

function entryTimestamp(date: string | undefined, previous = new Date().toISOString()) {
  return date ? getIsoAtStartOfDayAtTimeZone(date, "Europe/Helsinki") : previous;
}

function saveLog(db: DatabaseSync, log: Log) {
  log.entries.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  writeDocumentContentBySlug(db, "log", JSON.stringify(log));
}

function datedMemory(memory: string) {
  return `${getDateAtTimeZone(new Date(), "Europe/Helsinki")}: ${memory}`;
}

function createTools(db: DatabaseSync): AgentTool[] {
  return [
    queryDatabaseTool(db),
    executePythonTool,
    defineMutationTool(
      "AppendFoodLogEntry",
      "Log food consumption. Prefer saved ingredients, then Fineli, then reasonable estimates. " +
        "Usually record a meal as one entry. Return a concise summary of the saved nutrition.",
      foodSchema,
      (input) => {
        const log = readLog(db);
        const entry = FoodLogEntry.parse({
          ...foodValues(input),
          id: crypto.randomUUID(),
          ts: entryTimestamp(input.date),
          kind: "food",
        });
        log.entries.push(entry);
        saveLog(db, log);
        return entry;
      },
    ),
    defineMutationTool(
      "UpdateFoodLogEntry",
      "Replace a food entry's description, notes, ingredients, calories, and protein. " +
        "Read the current entry first and provide the complete replacement. " +
        "Omitted notes and ingredients are cleared, as are old carbohydrate and fat values. " +
        "The ID and timestamp are preserved unless a date is given.",
      foodSchema.safeExtend({ id: z.string().uuid() }),
      (input) => {
        const log = readLog(db);
        const index = log.entries.findIndex((entry) =>
          entry.id === input.id && entry.kind === "food"
        );
        if (index === -1) throw new Error("Food entry not found.");
        const previous = log.entries[index];
        const entry = FoodLogEntry.parse({
          ...previous,
          ...foodValues(input),
          carbs: undefined,
          fat: undefined,
          ts: entryTimestamp(input.date, previous.ts),
        });
        log.entries[index] = entry;
        saveLog(db, log);
        return entry;
      },
    ),
    defineMutationTool(
      "AppendWeightLogEntry",
      "Log a weight measurement in kilograms.",
      z.object({ date: dateSchema, weight: z.number().positive() }).strict(),
      (input) => {
        const log = readLog(db);
        const entry = WeightLogEntry.parse({
          id: crypto.randomUUID(),
          ts: entryTimestamp(input.date),
          kind: "weight",
          weight: input.weight,
        });
        log.entries.push(entry);
        saveLog(db, log);
        return entry;
      },
    ),
    defineMutationTool(
      "UpdateWeightLogEntry",
      "Correct a weight measurement in kilograms. Preserve its timestamp unless a date is given.",
      z.object({ id: z.string().uuid(), date: dateSchema, weight: z.number().positive() }).strict(),
      (input) => {
        const log = readLog(db);
        const index = log.entries.findIndex((entry) =>
          entry.id === input.id && entry.kind === "weight"
        );
        if (index === -1) throw new Error("Weight entry not found.");
        const entry = WeightLogEntry.parse({
          ...log.entries[index],
          weight: input.weight,
          ts: entryTimestamp(input.date, log.entries[index].ts),
        });
        log.entries[index] = entry;
        saveLog(db, log);
        return entry;
      },
    ),
    defineMutationTool(
      "RemoveLogEntry",
      "Remove a food or weight entry by its ID.",
      z.object({ id: z.string().uuid() }).strict(),
      (input) => {
        const log = readLog(db);
        const index = log.entries.findIndex((entry) => entry.id === input.id);
        if (index === -1) throw new Error("Log entry not found.");
        const [removed] = log.entries.splice(index, 1);
        saveLog(db, log);
        return { removed };
      },
    ),
    defineMutationTool(
      "UpdateProfile",
      "Update only the requested profile or goals. Omitted fields stay unchanged. " +
        "Read the existing profile before replacing userInfo, which is free-form profile text.",
      z.object({
        userInfo: z.string().nullable().optional(),
        targetDailyIntakeCalories: z.number().min(0).optional(),
        targetDailyIntakeProtein: z.number().min(0).optional(),
        targetWeightValue: z.number().positive().optional(),
        targetWeightDate: z.iso.datetime().optional(),
      }).strict().refine((input) => Object.keys(input).length > 0, "Provide at least one field."),
      (input) => {
        const config = Config.parse({ ...readConfig(db), ...input });
        writeDocumentContentBySlug(db, "config", JSON.stringify(config));
        return {
          userInfo: config.userInfo,
          targetDailyIntakeCalories: config.targetDailyIntakeCalories,
          targetDailyIntakeProtein: config.targetDailyIntakeProtein,
          targetWeightValue: config.targetWeightValue,
          targetWeightDate: config.targetWeightDate,
        };
      },
    ),
    defineMutationTool(
      "UpdateTrainingProgram",
      "Replace the training program text with the program the user requested or agreed to. " +
        "Read the existing program before making a partial revision.",
      z.object({ content: z.string() }).strict(),
      (input) => {
        writeDocumentContentBySlug(db, "training-program", input.content);
        return input;
      },
    ),
    defineMutationTool(
      "UpsertKnownIngredient",
      "Save an ingredient's nutrition per 100 g or 100 ml. Supply its ID to replace an existing " +
        "ingredient; omit the ID to create one. Read the existing ingredient before updating it.",
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        brand: z.string().optional(),
        unit: z.enum(["g", "ml"]),
        kcal: z.number().min(0),
        protein: z.number().min(0),
      }).strict(),
      (input) => {
        const known = readIngredients(db);
        const previous = input.id
          ? known.ingredients.find((entry) => entry.id === input.id)
          : undefined;
        if (input.id && !previous) throw new Error("Known ingredient not found.");
        const entry = Ingredient.parse({
          ...previous,
          id: input.id ?? crypto.randomUUID(),
          name: input.name,
          brand: input.brand,
          unit: input.unit,
          nutrients: {
            ...previous?.nutrients,
            kcal: input.kcal,
            protein: input.protein,
          },
        });
        if (previous) known.ingredients[known.ingredients.indexOf(previous)] = entry;
        else known.ingredients.push(entry);
        writeDocumentContentBySlug(db, "known-ingredients", JSON.stringify(known));
        return entry;
      },
    ),
    defineMutationTool(
      "RemoveKnownIngredient",
      "Remove a saved ingredient by its ID.",
      z.object({ id: z.string().uuid() }).strict(),
      (input) => {
        const known = readIngredients(db);
        const index = known.ingredients.findIndex((entry) => entry.id === input.id);
        if (index === -1) throw new Error("Known ingredient not found.");
        const [removed] = known.ingredients.splice(index, 1);
        writeDocumentContentBySlug(db, "known-ingredients", JSON.stringify(known));
        return { removed };
      },
    ),
    defineMutationTool(
      "SaveMemory",
      "Remember a durable fact explicitly stated by the user. Write concise factual text in the " +
        "user's language and perspective, without a date. Acknowledge the saved memory in chat.",
      z.object({ memory: z.string().trim().min(1) }).strict(),
      (input) => {
        const config = readConfig(db);
        const entry = datedMemory(input.memory);
        if (!config.memoryEntries.includes(entry)) config.memoryEntries.push(entry);
        writeDocumentContentBySlug(db, "config", JSON.stringify(config));
        return { entry };
      },
    ),
    defineMutationTool(
      "UpdateMemory",
      "Replace a saved memory. Identify it by its exact entry text, including the date prefix, " +
        "and provide new text without a date.",
      z.object({ entry: z.string().min(1), memory: z.string().trim().min(1) }).strict(),
      (input) => {
        const config = readConfig(db);
        const index = config.memoryEntries.indexOf(input.entry);
        if (index === -1) throw new Error("Memory not found.");
        const entry = datedMemory(input.memory);
        config.memoryEntries[index] = entry;
        writeDocumentContentBySlug(db, "config", JSON.stringify(config));
        return { entry };
      },
    ),
    defineMutationTool(
      "RemoveMemory",
      "Forget a saved memory, identified by its exact entry text including the date prefix.",
      z.object({ entry: z.string().min(1) }).strict(),
      (input) => {
        const config = readConfig(db);
        const index = config.memoryEntries.indexOf(input.entry);
        if (index === -1) throw new Error("Memory not found.");
        const [removed] = config.memoryEntries.splice(index, 1);
        writeDocumentContentBySlug(db, "config", JSON.stringify(config));
        return { removed };
      },
    ),
  ];
}

export { type AgentTool, createTools };
