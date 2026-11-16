/// <reference lib="deno.worker" />
/// <reference types="npm:@types/node@26.6.6" />

import { constants } from "node:sqlite";
import { type AgentDocuments, createQueryDatabase } from "../db/agent.ts";
import type { FineliFood } from "../db/fineli.ts";

interface QueryRequest {
  sql: string;
  params: (string | number | null)[];
  documents: AgentDocuments;
  fineli: FineliFood[];
}

self.onmessage = (event: MessageEvent<QueryRequest>) => {
  const { sql, params, documents, fineli } = event.data;
  let db;
  try {
    db = createQueryDatabase(documents, fineli);
    db.exec("PRAGMA query_only = ON; PRAGMA temp_store = MEMORY");
    db.limits.length = 65536;
    db.limits.sqlLength = 20000;
    db.limits.attach = 0;
    db.setAuthorizer((action, arg1, arg2) => {
      if (action === constants.SQLITE_PRAGMA && arg1 === "data_version" && arg2 === null) {
        return constants.SQLITE_OK;
      }
      if (action === constants.SQLITE_FUNCTION && arg2?.toLowerCase() === "load_extension") {
        return constants.SQLITE_DENY;
      }
      return [
          constants.SQLITE_SELECT,
          constants.SQLITE_READ,
          constants.SQLITE_FUNCTION,
          constants.SQLITE_RECURSIVE,
        ].includes(action)
        ? constants.SQLITE_OK
        : constants.SQLITE_DENY;
    });
    const statement = db.prepare(sql);
    if (sql.slice(statement.sourceSQL.length).trim()) {
      throw new Error(
        "Provide exactly one SQL statement, without trailing statements or comments.",
      );
    }
    const source = statement.sourceSQL.trim().replace(/;$/, "");
    const bounded = db.prepare(`SELECT * FROM (${source}\n) LIMIT 201`);
    bounded.setReturnArrays(true);
    bounded.setReadBigInts(true);
    const columns = statement.columns().map((column) => column.name);
    const rows: unknown[][] = [];
    let bytes = new TextEncoder().encode(JSON.stringify(columns)).length;
    let truncated = false;
    // Deno's SQLite iterator can suppress execution errors; all() preserves them.
    for (const row of bounded.all(...params)) {
      const values = (row as unknown as unknown[]).map((value) => {
        if (typeof value === "bigint") {
          return value <= BigInt(Number.MAX_SAFE_INTEGER) &&
              value >= BigInt(Number.MIN_SAFE_INTEGER)
            ? Number(value)
            : value.toString();
        }
        if (value instanceof Uint8Array) throw new Error("Return text or numbers, not blobs.");
        return value;
      });
      bytes += new TextEncoder().encode(JSON.stringify(values)).length + 1;
      if (rows.length >= 200 || bytes > 64000) {
        truncated = true;
        break;
      }
      rows.push(values);
    }
    self.postMessage({ result: { columns, rows, truncated } });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  } finally {
    db?.close();
  }
};
