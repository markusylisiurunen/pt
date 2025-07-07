import { z } from "zod";

const LogEntry = z.object({
  id: z.string().uuid(),
  ts: z.string().datetime(),
});

const FoodLogEntry = LogEntry.extend({
  kind: z.literal("food"),
  description: z.string().min(1),
  notes: z.string().optional(),
  kcal: z.number().min(0).optional(),
  protein: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
});
type FoodLogEntry = z.infer<typeof FoodLogEntry>;

const WeightLogEntry = LogEntry.extend({
  kind: z.literal("weight"),
  weight: z.number().min(0),
});
type WeightLogEntry = z.infer<typeof WeightLogEntry>;

const Log = z.object({
  entries: z.array(z.discriminatedUnion("kind", [FoodLogEntry, WeightLogEntry])).default([]),
});
type Log = z.infer<typeof Log>;

export { FoodLogEntry, Log, WeightLogEntry };
