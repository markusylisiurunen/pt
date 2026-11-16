import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "node:url";
import z from "zod";
import { runToolWorker } from "./worker.ts";

function executePythonTool(): Anthropic.Tool {
  return {
    name: "ExecutePython",
    description: "Run Python for non-trivial arithmetic, nutritional calculations, and unit " +
      "conversions. Print the results you need. Each call has a fresh interpreter and namespace, " +
      "with the standard library only. No network or host application data access. " +
      "Execution has a 30-second deadline and output is limited to 32 KiB. " +
      "Use QueryDatabase for retrieval and SQL aggregations, then pass values into Python.",
    input_schema: {
      type: "object",
      properties: { code: { type: "string", description: "Python code to execute." } },
      required: ["code"],
      additionalProperties: false,
    },
  };
}

async function executeExecutePythonTool(input: unknown): Promise<string> {
  const parsed = z.object({ code: z.string().min(1).max(50000) }).strict().parse(input);
  return await runToolWorker<string>(
    new URL("./python_worker.ts", import.meta.url),
    parsed,
    30000,
    [fileURLToPath(new URL(".", import.meta.resolve("pyodide")))],
  );
}

export { executeExecutePythonTool, executePythonTool };
