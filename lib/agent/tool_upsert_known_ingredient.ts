import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { KnownIngredients } from "../entities/ingredient.ts";

const description = `
Insert a new or update an existing known ingredient.
`.trim();

// deno-fmt-ignore
function upsertKnownIngredientTool(): Anthropic.Tool {
  return {
    name: "UpsertKnownIngredient",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ingredient's ID. Only set this field if you want to update an existing ingredient.",
        },
        name: {
          type: "string",
          description: "The name of the ingredient.",
        },
        brand: {
          type: "string",
          description: "An optional brand of the ingredient if provided by the user.",
        },
        unit: {
          type: "string",
          enum: ["g", "ml"],
          description: "The unit of the ingredient, either 'g' for grams or 'ml' for milliliters.",
        },
        kcal: {
          type: "number",
          description: "The amount of calories in the ingredient (either per 100g or 100ml).",
          minimum: 0,
        },
        protein: {
          type: "number",
          description: "The amount of protein in the ingredient (either per 100g or 100ml).",
          minimum: 0,
        },
      },
      required: ["name", "unit", "kcal", "protein"],
    },
  };
}

function executeUpsertKnownIngredientTool(db: DatabaseSync, input: unknown): string {
  const inputSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1),
    brand: z.string().optional(),
    unit: z.enum(["g", "ml"]),
    kcal: z.number().min(0),
    protein: z.number().min(0),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  const content = readDocumentContentBySlug(db, "known-ingredients");
  const knownIngredients = KnownIngredients.safeParse(JSON.parse(content || "{}"));
  if (!knownIngredients.success) {
    return "Error: Failed to parse known ingredients document.";
  }

  if (parsed.data.id) {
    knownIngredients.data.ingredients = knownIngredients.data.ingredients.map((ingredient) => {
      if (ingredient.id !== parsed.data.id) {
        return ingredient;
      }
      return {
        id: ingredient.id,
        name: parsed.data.name,
        brand: parsed.data.brand,
        unit: parsed.data.unit,
        nutrients: {
          kcal: parsed.data.kcal,
          protein: parsed.data.protein,
        },
      };
    });
  } else {
    knownIngredients.data.ingredients.push({
      id: crypto.randomUUID(),
      name: parsed.data.name,
      brand: parsed.data.brand,
      unit: parsed.data.unit,
      nutrients: {
        kcal: parsed.data.kcal,
        protein: parsed.data.protein,
      },
    });
  }

  writeDocumentContentBySlug(db, "known-ingredients", JSON.stringify(knownIngredients.data));

  return `Ingredient ${parsed.data.id ? "updated" : "added"} successfully.`;
}

export { executeUpsertKnownIngredientTool, upsertKnownIngredientTool };
