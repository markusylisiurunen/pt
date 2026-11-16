import Anthropic from "@anthropic-ai/sdk";
import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { querySchema, readAgentDocuments } from "../db/agent.ts";
import { loadFineliData } from "../db/fineli.ts";
import { runToolWorker } from "./worker.ts";

const queryInput = z.object({
  sql: z.string().min(1).max(20000),
  params: z.array(z.union([z.string(), z.number(), z.null()])).default([]),
}).strict();

function queryDatabaseTool(): Anthropic.Tool {
  return {
    name: "QueryDatabase",
    description:
      `Query the user's data and local Fineli database using one read-only SQLite SELECT or WITH query.
Use positional ? parameters for values. Results contain columns, row arrays, and a truncated flag.
At most 200 rows and 64 KiB are returned; narrow the query or aggregate when truncated.

Schema:
${querySchema}
Timestamps are UTC ISO 8601 strings. local_date is the Europe/Helsinki calendar date (YYYY-MM-DD).
Calories are kcal; protein is grams. Missing nutrition is NULL, not zero.
food_ingredients contains optional meal breakdowns, with zero-based positions.
known_ingredients values are per 100 of its unit (g or ml). Fineli values are per 100 grams;
fineli_portions supplies gram weights for servings, including volume-based servings.
profile and training_program each contain one row. memories.entry is the exact saved text.

Search Fineli using Finnish terms, prefixes, and FTS5 syntax, for example:
SELECT f.* FROM fineli_search s JOIN fineli_foods f ON f.rowid = s.rowid
WHERE fineli_search MATCH ? ORDER BY s.rank LIMIT 15
with params ["broileri AND rintafile*"]. Try alternate words or broader prefixes if needed.
Choose the actual preparation/product from the returned records. FTS matches are lexical,
not semantic. For substring matching, use lower(name) LIKE ? (SQLite lower is ASCII-only).`,
    input_schema: z.toJSONSchema(queryInput, { io: "input" }) as Anthropic.Tool.InputSchema,
  };
}

async function executeQueryDatabaseTool(db: DatabaseSync, input: unknown): Promise<string> {
  const parsed = queryInput.parse(input);
  const result = await runToolWorker(
    new URL("./query_worker.ts", import.meta.url),
    { ...parsed, documents: readAgentDocuments(db), fineli: loadFineliData() },
    10000,
  );
  return JSON.stringify(result);
}

export { executeQueryDatabaseTool, queryDatabaseTool };
