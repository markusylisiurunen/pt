import { fileURLToPath } from "node:url";
import z from "zod";
import { defineReadTool } from "./tool.ts";
import { runToolProcess } from "./process.ts";

const executePythonTool = defineReadTool(
  "ExecutePython",
  "Run Python for non-trivial arithmetic, such as nutrition calculations and unit conversions. " +
    "Print the results you need. Each call starts a fresh interpreter with only the standard " +
    "library, and it cannot reach the network or the user's data. Fetch values with " +
    "QueryDatabase first and write them into the code. A call fails if it runs longer than 30 " +
    "seconds or prints more than 32 KiB.",
  z.object({ code: z.string().min(1).max(50000).describe("Python code to execute.") }).strict(),
  (input) =>
    runToolProcess<string>(
      new URL("./python_process.ts", import.meta.url),
      input,
      30000,
      [fileURLToPath(new URL(".", import.meta.resolve("pyodide")))],
    ),
);

export { executePythonTool };
