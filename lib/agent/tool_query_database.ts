import { DatabaseSync } from "node:sqlite";
import z from "zod";
import { querySchema, readAgentDocuments } from "../db/agent.ts";
import { loadFineliData } from "../db/fineli.ts";
import { defineReadTool } from "./tool.ts";
import { runToolProcess } from "./process.ts";

const queryInput = z.object({
  sql: z.string().min(1).max(20000),
  params: z.array(z.union([z.string(), z.number(), z.null()])).default([]),
}).strict();

function queryDatabaseTool(db: DatabaseSync) {
  return defineReadTool(
    "QueryDatabase",
    `Query the user's data and local Fineli database using one read-only SQLite SELECT or WITH query.
Use positional ? parameters for values. Results contain columns, row arrays, and a truncated flag.
Results stop at 200 rows or 64 KiB. When truncated is true, narrow the query or aggregate.

Schema:
${querySchema}
Timestamps are UTC ISO 8601 strings. local_date is the Europe/Helsinki calendar date (YYYY-MM-DD).
Calories are kcal; protein is grams. Missing nutrition is NULL, not zero.
The id columns can repeat, so use rowid to tell rows apart. Rowids are rebuilt for every query.
food_ingredients contains optional meal breakdowns, with zero-based positions. Join
food_ingredients.entry_rowid to food_log.rowid. entry_id is the meal's id.
known_ingredients values are per 100 of its unit (g or ml). Fineli values are per 100 grams;
fineli_portions supplies gram weights for servings, including volume-based servings.
profile and training_program each contain one row. memories.entry is the exact saved text.

Fineli names are in Finnish. Search them with FTS5 syntax and prefixes, for example:
SELECT f.* FROM fineli_search s JOIN fineli_foods f ON f.rowid = s.rowid
WHERE fineli_search MATCH ? ORDER BY s.rank LIMIT 15
with params ["broileri AND rintafile*"]. FTS matches words and prefixes only, so when a search
finds nothing suitable, try synonyms or broader prefixes. For substring matching, use
lower(name) LIKE ? (SQLite lower() changes only ASCII letters). From the results, choose
the record that matches the actual product and how it was prepared.`,
    queryInput,
    async (input) => {
      const result = await runToolProcess(
        new URL("./query_process.ts", import.meta.url),
        { ...input, documents: readAgentDocuments(db), fineli: loadFineliData() },
        10000,
      );
      return JSON.stringify(result);
    },
  );
}

export { queryDatabaseTool };
