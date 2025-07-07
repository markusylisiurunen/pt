import { z } from "zod";

const Ingredient = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().optional(),
  unit: z.enum(["g", "ml"]),
  nutrients: z.object({
    kcal: z.number().min(0),
    protein: z.number().min(0),
    carbs: z.number().min(0).optional(),
    fat: z.number().min(0).optional(),
  }),
});
type Ingredient = z.infer<typeof Ingredient>;

const KnownIngredients = z.object({
  ingredients: z.array(Ingredient).default([]),
});
type KnownIngredients = z.infer<typeof KnownIngredients>;

export { Ingredient, KnownIngredients };
