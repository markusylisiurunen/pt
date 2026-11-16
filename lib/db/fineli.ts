import z from "zod";

const fineliSchema = z.array(z.object({
  id: z.string(),
  name: z.string(),
  class: z.string().nullable(),
  process: z.string().nullable(),
  nutrients: z.object({ kcal: z.number().nullable(), protein: z.number().nullable() }),
  units: z.array(z.object({ unit: z.string(), description: z.string(), mass: z.number() })),
}));

type FineliFood = z.infer<typeof fineliSchema>[number];
let fineliData: FineliFood[] | undefined;

function loadFineliData(): FineliFood[] {
  fineliData ??= fineliSchema.parse(
    JSON.parse(Deno.readTextFileSync(new URL("../../data/fineli/fineli.json", import.meta.url))),
  );
  return fineliData;
}

export { type FineliFood, loadFineliData };
