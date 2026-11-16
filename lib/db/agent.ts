import { DatabaseSync } from "node:sqlite";
import { Config } from "../entities/config.ts";
import { KnownIngredients } from "../entities/ingredient.ts";
import { Log } from "../entities/log.ts";
import { getDateAtTimeZone } from "../util/datetime.ts";
import { readDocumentContentBySlug } from "./docs.ts";
import type { FineliFood } from "./fineli.ts";

const querySchema = `
CREATE TABLE food_log (
  id TEXT PRIMARY KEY, timestamp TEXT, local_date TEXT, description TEXT, notes TEXT,
  kcal REAL, protein REAL
);
CREATE TABLE food_ingredients (
  entry_id TEXT, position INTEGER, description TEXT, kcal REAL, protein REAL
);
CREATE TABLE weight_log (
  id TEXT PRIMARY KEY, timestamp TEXT, local_date TEXT, weight_kg REAL
);
CREATE TABLE known_ingredients (
  id TEXT PRIMARY KEY, name TEXT, brand TEXT, unit TEXT, kcal_per_100 REAL, protein_per_100 REAL
);
CREATE TABLE profile (
  user_info TEXT, daily_kcal REAL, daily_protein REAL, target_weight_kg REAL, target_weight_date TEXT
);
CREATE TABLE memories (entry TEXT);
CREATE TABLE training_program (content TEXT);
CREATE TABLE fineli_foods (
  id TEXT PRIMARY KEY, name TEXT, category TEXT, process TEXT,
  kcal_per_100g REAL, protein_per_100g REAL
);
CREATE TABLE fineli_portions (food_id TEXT, description TEXT, mass_g REAL);
CREATE VIRTUAL TABLE fineli_search USING fts5(name, category, content='fineli_foods');
`;

interface AgentDocuments {
  config: Config;
  log: Log;
  ingredients: KnownIngredients;
  trainingProgram: string;
}

function readLog(db: DatabaseSync) {
  return Log.parse(JSON.parse(readDocumentContentBySlug(db, "log")));
}

function readConfig(db: DatabaseSync) {
  return Config.parse(JSON.parse(readDocumentContentBySlug(db, "config")));
}

function readIngredients(db: DatabaseSync) {
  return KnownIngredients.parse(JSON.parse(readDocumentContentBySlug(db, "known-ingredients")));
}

function readAgentDocuments(db: DatabaseSync): AgentDocuments {
  return {
    config: readConfig(db),
    log: readLog(db),
    ingredients: readIngredients(db),
    trainingProgram: readDocumentContentBySlug(db, "training-program"),
  };
}

function createQueryDatabase(documents: AgentDocuments, fineli: FineliFood[]): DatabaseSync {
  const db = new DatabaseSync(":memory:", { allowExtension: false });
  try {
    db.exec(querySchema);
    db.exec("BEGIN");
    const food = db.prepare("INSERT INTO food_log VALUES (?, ?, ?, ?, ?, ?, ?)");
    const ingredient = db.prepare("INSERT INTO food_ingredients VALUES (?, ?, ?, ?, ?)");
    const weight = db.prepare("INSERT INTO weight_log VALUES (?, ?, ?, ?)");
    for (const entry of documents.log.entries) {
      const timestamp = new Date(entry.ts).toISOString();
      const date = getDateAtTimeZone(timestamp, "Europe/Helsinki");
      if (entry.kind === "food") {
        food.run(
          entry.id,
          timestamp,
          date,
          entry.description,
          entry.notes ?? null,
          entry.kcal ?? null,
          entry.protein ?? null,
        );
        entry.ingredients?.forEach((item, index) => {
          ingredient.run(entry.id, index, item.description, item.kcal, item.protein);
        });
      } else {
        weight.run(entry.id, timestamp, date, entry.weight);
      }
    }
    const known = db.prepare("INSERT INTO known_ingredients VALUES (?, ?, ?, ?, ?, ?)");
    for (const item of documents.ingredients.ingredients) {
      known.run(
        item.id,
        item.name,
        item.brand ?? null,
        item.unit,
        item.nutrients.kcal,
        item.nutrients.protein,
      );
    }
    const config = documents.config;
    db.prepare("INSERT INTO profile VALUES (?, ?, ?, ?, ?)").run(
      config.userInfo,
      config.targetDailyIntakeCalories,
      config.targetDailyIntakeProtein,
      config.targetWeightValue,
      config.targetWeightDate,
    );
    const memory = db.prepare("INSERT INTO memories VALUES (?)");
    for (const entry of config.memoryEntries) memory.run(entry);
    db.prepare("INSERT INTO training_program VALUES (?)").run(documents.trainingProgram);

    const fineliFood = db.prepare("INSERT INTO fineli_foods VALUES (?, ?, ?, ?, ?, ?)");
    const portion = db.prepare("INSERT INTO fineli_portions VALUES (?, ?, ?)");
    for (const item of fineli) {
      fineliFood.run(
        item.id,
        item.name,
        item.class,
        item.process,
        item.nutrients.kcal,
        item.nutrients.protein,
      );
      for (const unit of item.units) portion.run(item.id, unit.description, unit.mass);
    }
    db.exec("INSERT INTO fineli_search(fineli_search) VALUES ('rebuild')");
    db.exec("COMMIT");
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export {
  type AgentDocuments,
  createQueryDatabase,
  querySchema,
  readAgentDocuments,
  readConfig,
  readIngredients,
  readLog,
};
