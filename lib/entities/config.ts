import { z } from "zod";

const Config = z.object({
  userInfo: z.string().nullable().default(null),
  memoryEntries: z.array(z.string()).default([]),
  targetDailyIntakeCalories: z.number().min(0),
  targetDailyIntakeProtein: z.number().min(0),
  targetWeightDate: z.string().datetime(),
  targetWeightValue: z.number().min(0),
});
type Config = z.infer<typeof Config>;

export { Config };
