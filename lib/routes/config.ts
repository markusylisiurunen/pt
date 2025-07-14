import { DatabaseSync } from "node:sqlite";
import { readDocumentContentBySlug } from "../db/docs.ts";
import { Config } from "../entities/config.ts";
import { FoodLogEntry, Log } from "../entities/log.ts";
import { getDateAtTimeZone } from "../util/datetime.ts";

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
    const nowDateStr = getDateAtTimeZone(new Date().toISOString(), "Europe/Helsinki");
    const kcalToday = log.data.entries.reduce((sum, i) => {
      if (i.kind !== "food") return sum;
      const dateStr = getDateAtTimeZone(i.ts, "Europe/Helsinki");
      if (dateStr !== nowDateStr) return sum;
      return sum + (i.kcal ?? 0);
    }, 0);
    const proteinToday = log.data.entries.reduce((sum, i) => {
      if (i.kind !== "food") return sum;
      const dateStr = getDateAtTimeZone(i.ts, "Europe/Helsinki");
      if (dateStr !== nowDateStr) return sum;
      return sum + (i.protein ?? 0);
    }, 0);
    // grab the food intake history for the last 14 days
    const foodIntakeHistory = log.data.entries
      .filter((i): i is FoodLogEntry => i.kind === "food")
      .filter((i) => {
        const dateStr = getDateAtTimeZone(i.ts, "Europe/Helsinki");
        const nowStr = getDateAtTimeZone(new Date().toISOString(), "Europe/Helsinki");
        const diff = new Date(nowStr).getTime() - new Date(dateStr).getTime();
        return diff >= 0 && diff <= 14 * 24 * 3600 * 1000;
      })
      .reduce((acc, i) => {
        const dateStr = getDateAtTimeZone(i.ts, "Europe/Helsinki");
        if (!acc[dateStr]) {
          acc[dateStr] = { kcal: 0, protein: 0 };
        }
        acc[dateStr].kcal += i.kcal ?? 0;
        acc[dateStr].protein += i.protein ?? 0;
        return acc;
      }, {} as Record<string, { kcal: number; protein: number }>);
    const foodIntakeHistoryArray = Object.entries(foodIntakeHistory).map(([date, intake]) => ({
      date: date,
      kcal: intake.kcal,
      protein: intake.protein,
    }));
    foodIntakeHistoryArray.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    // filter the weight history to the last 6 months
    const weightHistoryMinDate = new Date();
    weightHistoryMinDate.setDate(weightHistoryMinDate.getDate() - 6 * 30);
    const weightHistory = log.data.entries
      .filter((i) => i.kind === "weight")
      .filter((i) => new Date(i.ts) >= weightHistoryMinDate)
      .map((i) => ({ date: i.ts, weight: i.weight }));
    // filter the food log entries to today
    const foodLogEntriesToday = log.data.entries
      .filter((i): i is FoodLogEntry => {
        if (i.kind !== "food") return false;
        const dateStr = getDateAtTimeZone(i.ts, "Europe/Helsinki");
        return dateStr === nowDateStr;
      })
      .map((i) => ({ ts: i.ts, label: i.description, kcal: i.kcal, protein: i.protein }));
    // construct the result object
    const result = JSON.stringify({
      config: config.data,
      foodIntakeToday: { kcal: kcalToday, protein: proteinToday },
      foodIntakeHistory: foodIntakeHistoryArray,
      weightHistory: weightHistory,
      foodLogToday: foodLogEntriesToday,
    });
    return new Response(result, { headers: { "content-type": "application/json" } });
  };
}

export { configRoute };
