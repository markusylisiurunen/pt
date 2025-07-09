import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import z from "zod";

const fineliSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    class: z.string().nullable(),
    process: z.string().nullable(),
    nutrients: z.object({
      kcal: z.number().nullable(),
      protein: z.number().nullable(),
    }),
    units: z.array(
      z.object({
        unit: z.string(),
        description: z.string(),
        mass: z.number(),
      }),
    ),
  }),
);

let fineliData: z.infer<typeof fineliSchema> | null = null;

function loadFineliData() {
  if (fineliData) {
    return fineliData;
  }
  const data = Deno.readTextFileSync("./data/fineli/fineli.json");
  fineliData = fineliSchema.parse(JSON.parse(data));
  return fineliData;
}

const description = `
Search for food items in the Finnish Fineli database. Use Finnish language descriptions of foods or ingredients (e.g., "Fazer juuri paistettu kanelipulla" or "Vadelman makuinen mysli"). This tool ONLY finds and returns matching food items - you must handle all analysis and calculations yourself.

The tool returns raw nutritional data per 100g or 100ml with available serving units for matching foods.

Example queries:
- "syöntikypsä avokado"
- "hunaja fileesuikale tai hunajalla maustettu kanafile"
- "pakastetut mansikat"
- "Valio pehmeä maitorahka tai jokin muu vähärasvainen maitorahka (alle 10% rasvaa)"
`.trim();

function searchFineliTool(): Anthropic.Tool {
  return {
    name: "SearchFineli",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The query to search for in the Fineli database.",
        },
      },
      required: ["query"],
    },
  };
}

async function executeSearchFineliTool(
  geminiApiKey: string,
  input: unknown,
): Promise<string> {
  const inputSchema = z.object({
    query: z.string(),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  const BATCH_SIZE = 512;
  const fineli = loadFineliData();
  const batches = [];
  for (let i = 0; i < fineli.length; i += BATCH_SIZE) {
    batches.push(fineli.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) => launchSearchAgent(geminiApiKey, parsed.data.query, batch)),
  );

  return results.map((result, index) => `Result set ${index + 1}:\n${result}`)
    .join("\n\n");
}

async function launchSearchAgent(
  geminiApiKey: string,
  query: string,
  batch: z.infer<typeof fineliSchema>,
) {
  const prompt = `
You are a food database search engine. Find the best matching food items for: "${query}"

Match foods based on the query's core intent:
- For simple ingredient queries (e.g., "banaani"), prioritize the plain/raw form first, then minimally processed variants
- For specific product queries (e.g., "Fazer kanelipulla"), match exact or very similar products
- For compound/prepared food queries (e.g., "banaanileipä"), include items where the queried term is the primary characteristic
- Consider query specificity: vague queries warrant broader matches, specific queries require precise matches
- Exclude items where the query term is only a minor component or flavor variant unless no better matches exist

Examples:
- "banaani" -> plain bananas, dried bananas (YES) | banana bread, banana yogurt (NO, unless specifically requested)
- "maito" -> milk products (YES) | milk chocolate, milk-based sauces (NO)
- "kanafile hunajalla" -> honey-glazed chicken (YES) | plain chicken or plain honey (NO)
- "avokado" -> ripe avocados (YES) | avocado oil, avocado toast (NO)

Return the most relevant matching items in this exact format in Finnish:
<match_1>
Name: [item.name] ([item.class], [item.process])
Kcal: [per 100g or 100ml]
Protein: [per 100g or 100ml]g
Units: [list unit descriptions with masses]
</match_1>
<match_2>
...
</match_2>

If no reasonable matches found, return: "Ei osumia"

Do not provide explanations, analysis, or calculations. Only return the formatted list of matching food items. Answer in Finnish.

Never return more than 25 matches, and always order them by relevance to the query.

Database:
${formatBatchForPrompt(batch)}
  `.trim();
  const ai = new GoogleGenAI({ apiKey: geminiApiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      maxOutputTokens: 4096,
      temperature: 0.2,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return response.text?.trim() ?? "Ei osumia.";
}

function formatBatchForPrompt(batch: z.infer<typeof fineliSchema>) {
  const result: string[] = [];
  for (const item of batch) {
    let str = "";
    str += `Name: ${item.name} (${item.class}, ${item.process})\n`;
    str += `Kcal: ${item.nutrients.kcal?.toFixed(1) ?? "n/a"}\n`;
    str += `Protein: ${item.nutrients.protein?.toFixed(1) ?? "n/a"}\n`;
    str += `Units: ${
      item.units
        .map((u) => `${u.description} (${u.mass.toFixed(1)} g)`)
        .join(", ")
    }\n`;
    result.push(str);
  }
  return result.join("\n---\n");
}

export { executeSearchFineliTool, searchFineliTool };
