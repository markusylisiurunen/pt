import { z } from "zod";

const LogEntry = z.object({
  id: z.string().uuid(),
  ts: z.string().datetime(),
});

const FoodLogIngredient = z.object({
  description: z.string().min(1),
  kcal: z.number().min(0),
  protein: z.number().min(0),
});
type FoodLogIngredient = z.infer<typeof FoodLogIngredient>;

const FoodLogEntry = LogEntry.extend({
  kind: z.literal("food"),
  description: z.string().min(1),
  notes: z.string().optional(),
  ingredients: z.array(FoodLogIngredient).min(1).optional(),
  kcal: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
}).transform((entry) =>
  entry.ingredients
    ? {
      ...entry,
      kcal: Math.round(entry.ingredients.reduce((sum, item) => sum + item.kcal, 0) * 1e6) / 1e6,
      protein: Math.round(entry.ingredients.reduce((sum, item) => sum + item.protein, 0) * 1e6) /
        1e6,
    }
    : entry
);
type FoodLogEntry = z.infer<typeof FoodLogEntry>;

const WeightLogEntry = LogEntry.extend({
  kind: z.literal("weight"),
  weight: z.number().min(0),
});
type WeightLogEntry = z.infer<typeof WeightLogEntry>;

const Log = z.object({
  entries: z.array(z.union([FoodLogEntry, WeightLogEntry])).default([]),
});
type Log = z.infer<typeof Log>;

export { FoodLogEntry, FoodLogIngredient, Log, WeightLogEntry };
