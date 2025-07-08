import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";
import { Log } from "../entities/log.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

function configRoute(db: DatabaseSync): Route {
  return (req: Request) => {
    if (req.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    // read and parse the config and log documents
    const configDoc = readDocumentContentBySlug(db, "config") || "{}";
    const config = Config.safeParse(JSON.parse(configDoc));
    if (!config.success) {
      return new Response("Invalid config document", { status: 500 });
    }
    const logDoc = readDocumentContentBySlug(db, "log") || "{}";
    const log = Log.safeParse(JSON.parse(logDoc));
    if (!log.success) {
      return new Response("Invalid log document", { status: 500 });
    }
    // calculate the food intake for today
    const nowDateStr = new Date().toISOString().split("T")[0];
    const kcalToday = log.data.entries.reduce((sum, i) => {
      if (i.kind !== "food") return sum;
      const dateStr = new Date(i.ts).toISOString().split("T")[0];
      if (dateStr !== nowDateStr) return sum;
      return sum + (i.kcal ?? 0);
    }, 0);
    const proteinToday = log.data.entries.reduce((sum, i) => {
      if (i.kind !== "food") return sum;
      const dateStr = new Date(i.ts).toISOString().split("T")[0];
      if (dateStr !== nowDateStr) return sum;
      return sum + (i.protein ?? 0);
    }, 0);
    // filter the weight history to the last 6 months
    const weightHistoryMinDate = new Date();
    weightHistoryMinDate.setDate(weightHistoryMinDate.getDate() - 6 * 30);
    const weightHistory = log.data.entries
      .filter((i) => i.kind === "weight")
      .filter((i) => new Date(i.ts) >= weightHistoryMinDate)
      .map((i) => ({ date: i.ts, weight: i.weight }));
    // construct the result object
    const result = JSON.stringify({
      config: config.data,
      foodIntakeToday: { kcal: kcalToday, protein: proteinToday },
      weightHistory: weightHistory,
    });
    return new Response(result, { headers: { "content-type": "application/json" } });
  };
}

export { configRoute };
