import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug, writeDocumentContentBySlug } from "../db/docs.ts";
import { migrateDocuments, migrateSchema } from "../db/migrate.ts";
import { Config } from "../entities/config.ts";
import { Log } from "../entities/log.ts";
import { importRoute } from "../routes/import.ts";
import { executeExecutePythonTool } from "./tool_execute_python.ts";
import { executeQueryDatabaseTool } from "./tool_query_database.ts";
import { createTools } from "./tools.ts";
import { runToolWorker } from "./worker.ts";

function createDatabase() {
  const db = new DatabaseSync(":memory:");
  migrateSchema(db);
  migrateDocuments(db);
  return db;
}

Deno.test("food corrections preserve identity and derive totals from ingredient contributions", async () => {
  const db = createDatabase();
  try {
    const tools = createTools(db);
    const call = async (name: string, input: unknown) =>
      JSON.parse(await tools.find((tool) => tool.definition.name === name)!.execute(input));
    const original = await call("AppendFoodLogEntry", {
      date: "2026-01-05",
      description: "Chicken and rice",
      kcal: 999,
      protein: 999,
      ingredients: [
        { description: "150 g chicken", kcal: 248, protein: 46 },
        { description: "210 g rice", kcal: 272, protein: 2 },
      ],
    });
    assert.equal(original.kcal, 520);
    assert.equal(original.protein, 48);
    assert.equal(original.ts, "2026-01-04T22:00:00.000Z");

    const corrected = await call("UpdateFoodLogEntry", {
      id: original.id,
      description: "Corrected meal",
      ingredients: [
        { description: "200 g chicken", kcal: 330, protein: 61 },
        { description: "210 g rice", kcal: 272, protein: 2 },
      ],
    });
    assert.equal(corrected.id, original.id);
    assert.equal(corrected.ts, original.ts);
    assert.equal(corrected.kcal, 602);
    assert.equal(corrected.protein, 63);
    assert.equal(Log.parse(JSON.parse(readDocumentContentBySlug(db, "log"))).entries.length, 1);

    const content = readDocumentContentBySlug(db, "log");
    const response = await importRoute(db)(
      new Request("http://localhost/api/import", {
        method: "POST",
        body: JSON.stringify({ slug: "log", content }),
      }),
    );
    assert.equal(response.status, 200);
    assert.equal(readDocumentContentBySlug(db, "log"), content);

    const simple = await call("UpdateFoodLogEntry", {
      id: original.id,
      description: "User-supplied totals",
      kcal: 500,
      protein: 30,
    });
    assert.equal(simple.ingredients, undefined);
    assert.equal(simple.kcal, 500);
    await assert.rejects(() =>
      call("AppendFoodLogEntry", {
        date: "2026-02-30",
        description: "Invalid date",
        kcal: 1,
        protein: 1,
      })
    );
  } finally {
    db.close();
  }
});

Deno.test("profile and memory tools preserve unrelated configuration and legacy entries", async () => {
  const db = createDatabase();
  try {
    const config = Config.parse(JSON.parse(readDocumentContentBySlug(db, "config")));
    config.userInfo = "Existing profile";
    config.themeHue = 200;
    config.memoryEntries = ["2020-01-01: I prefer vegetarian food."];
    writeDocumentContentBySlug(db, "config", JSON.stringify(config));
    const tools = createTools(db);
    const call = async (name: string, input: unknown) =>
      JSON.parse(await tools.find((tool) => tool.definition.name === name)!.execute(input));
    await call("UpdateProfile", { targetDailyIntakeProtein: 150 });
    await call("UpdateMemory", {
      entry: config.memoryEntries[0],
      memory: "I eat vegetarian food and fish.",
    });
    const saved = Config.parse(JSON.parse(readDocumentContentBySlug(db, "config")));
    assert.equal(saved.targetDailyIntakeProtein, 150);
    assert.equal(saved.userInfo, config.userInfo);
    assert.equal(saved.themeHue, 200);
    assert.equal(saved.targetDailyIntakeCalories, config.targetDailyIntakeCalories);
    assert.match(saved.memoryEntries[0], /: I eat vegetarian food and fish\.$/);
    await call("RemoveMemory", { entry: saved.memoryEntries[0] });
    assert.deepEqual(
      Config.parse(JSON.parse(readDocumentContentBySlug(db, "config"))).memoryEntries,
      [],
    );
    await assert.rejects(() => call("UpdateProfile", { themeHue: 1 }));
  } finally {
    db.close();
  }
});

Deno.test("queries expose Helsinki dates, meal contributions, and original Fineli data", async () => {
  const db = createDatabase();
  try {
    writeDocumentContentBySlug(
      db,
      "log",
      JSON.stringify({
        entries: [{
          id: crypto.randomUUID(),
          ts: "2026-07-01T21:30:00.000Z",
          kind: "food",
          description: "Evening snack",
          kcal: 120,
          protein: 8,
          ingredients: [{ description: "Yogurt", kcal: 120, protein: 8 }],
        }],
      }),
    );
    const query = async (sql: string, params: (string | number | null)[] = []) =>
      JSON.parse(await executeQueryDatabaseTool(db, { sql, params }));
    assert.deepEqual(
      (await query(
        "SELECT local_date, SUM(i.kcal), SUM(i.protein) FROM food_log f " +
          "JOIN food_ingredients i ON i.entry_id = f.id GROUP BY local_date",
      )).rows,
      [["2026-07-02", 120, 8]],
    );

    for (
      const [term, expected] of [
        ["banaani", "BANAANI, KUORITTU"],
        ["broileri AND rintafile*", "BROILERI, RINTAFILEE, NAHATON"],
        ["maitorah*", "MAITORAHKA"],
      ]
    ) {
      const result = await query(
        "SELECT f.name, f.kcal_per_100g, f.protein_per_100g FROM fineli_search s " +
          "JOIN fineli_foods f ON f.rowid = s.rowid WHERE fineli_search MATCH ? " +
          "ORDER BY s.rank LIMIT 100",
        [term],
      );
      assert.ok(result.rows.some((row: unknown[]) => String(row[0]).includes(expected)), term);
      assert.ok(result.rows.every((row: unknown[]) => typeof row[1] === "number"));
    }
  } finally {
    db.close();
  }
});

Deno.test("SQL access rejects writes, extra statements, private tables, and execution errors", async () => {
  const db = createDatabase();
  try {
    for (
      const sql of [
        "DELETE FROM food_log",
        "PRAGMA query_only = OFF",
        "ATTACH DATABASE ':memory:' AS other",
        "SELECT load_extension('anything')",
        "SELECT * FROM chats",
        "SELECT * FROM documents",
        "SELECT 1; DELETE FROM food_log",
        "SELECT json('invalid')",
        "SELECT name FROM fineli_search WHERE fineli_search MATCH 'bad AND'",
      ]
    ) {
      await assert.rejects(() => executeQueryDatabaseTool(db, { sql }), sql);
    }
    const result = JSON.parse(
      await executeQueryDatabaseTool(db, {
        sql: "SELECT name FROM fineli_foods",
      }),
    );
    assert.equal(result.rows.length, 200);
    assert.equal(result.truncated, true);
    assert.equal(Log.parse(JSON.parse(readDocumentContentBySlug(db, "log"))).entries.length, 0);
  } finally {
    db.close();
  }
});

Deno.test("Python calculations have fresh state and no application globals", async () => {
  assert.equal(
    await executeExecutePythonTool({ code: "x = 150\nprint(x / 100 * 165)" }),
    "247.5\n",
  );
  assert.equal(
    await executeExecutePythonTool({
      code: "import js\nprint('x' in globals())\nprint(hasattr(js, 'Deno'))",
    }),
    "False\nFalse\n",
  );
  await assert.rejects(
    () => executeExecutePythonTool({ code: "raise ValueError('invalid calculation')" }),
    /invalid calculation/,
  );
});

Deno.test("tool workers terminate when code does not finish", async () => {
  const url = URL.createObjectURL(
    new Blob(["onmessage = () => { while (true) {} };"], {
      type: "application/javascript",
    }),
  );
  try {
    await assert.rejects(() => runToolWorker(new URL(url), {}, 100), /timed out/);
  } finally {
    URL.revokeObjectURL(url);
  }
});
