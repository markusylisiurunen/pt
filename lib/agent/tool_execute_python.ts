import { fileURLToPath } from "node:url";
import z from "zod";
import { defineReadTool } from "./tool.ts";
import { runToolWorker } from "./worker.ts";

const executePythonTool = defineReadTool(
  "ExecutePython",
  "Run Python for non-trivial arithmetic, nutritional calculations, and unit " +
    "conversions. Print the results you need. Each call has a fresh interpreter and namespace, " +
    "with the standard library only. No network or host application data access. " +
    "Execution has a 30-second deadline and output is limited to 32 KiB. " +
    "Use QueryDatabase for retrieval and SQL aggregations, then pass values into Python.",
  z.object({ code: z.string().min(1).max(50000).describe("Python code to execute.") }).strict(),
  (input) =>
    runToolWorker<string>(
      new URL("./python_worker.ts", import.meta.url),
      input,
      30000,
      [fileURLToPath(new URL(".", import.meta.resolve("pyodide")))],
    ),
);

export { executePythonTool };
