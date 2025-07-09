import Anthropic from "@anthropic-ai/sdk";
import { loadPyodide, PyodideInterface } from "pyodide";
import z from "zod";

const description = `
Execute Python code using Pyodide in a WebAssembly environment. Returns the stdout output from the code execution.

The Python environment includes:
- Python standard library only (most modules functional, with some WebAssembly-related limitations)
- No additional packages like numpy, pandas, scipy, etc. are available
- Common standard library modules available: math, random, datetime, json, re, collections, itertools, etc.

Important notes:
- Each execution runs in a fresh, isolated environment - no variables, imports, or state persist between tool calls
- Network access and file system operations have WebAssembly limitations
- If the code produces stderr output, it will be returned as an error
- If no output is produced to stdout, returns a success message
`.trim();

let pyodideInstance: PyodideInterface | null = null;
let pyodideLoadPromise: Promise<PyodideInterface> | null = null;

let initialGlobals: Set<string> | null = null;

let executionLock: Promise<string | void> = Promise.resolve();

function getPyodideInstance() {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (!pyodideLoadPromise) {
    pyodideLoadPromise = loadPyodide().then((instance) => {
      pyodideInstance = instance;
      initialGlobals = new Set(instance.runPython("list(globals().keys())"));
      return instance;
    });
  }

  return pyodideLoadPromise;
}

// deno-fmt-ignore
function executePythonTool(): Anthropic.Tool {
  return {
    name: "ExecutePython",
    description: description,
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "The Python code to execute.",
        },
      },
      required: ["code"],
    },
  };
}

// deno-lint-ignore require-await
async function executeExecutePythonTool(input: unknown): Promise<string> {
  const inputSchema = z.object({
    code: z.string().min(1),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  const currentExecution = executionLock.then(async () => {
    try {
      const pyodide = await getPyodideInstance();

      let capturedOutput = "";
      let capturedError = "";

      const outputBuffer: number[] = [];
      const errorBuffer: number[] = [];

      const decoder = new TextDecoder("utf-8");

      pyodide.setStdout({
        raw(charCode: number) {
          outputBuffer.push(charCode);
        },
      });
      pyodide.setStderr({
        raw(charCode: number) {
          errorBuffer.push(charCode);
        },
      });

      pyodide.runPython(parsed.data.code);

      if (outputBuffer.length > 0) {
        capturedOutput = decoder.decode(new Uint8Array(outputBuffer));
      }
      if (errorBuffer.length > 0) {
        capturedError = decoder.decode(new Uint8Array(errorBuffer));
      }

      const currentGlobals = pyodide.runPython("list(globals().keys())");
      for (const key of currentGlobals) {
        if (!initialGlobals!.has(key)) {
          pyodide.runPython(`del globals()['${key}']`);
        }
      }

      if (capturedError) {
        return `Got a non-empty stderr output:\n${capturedError}`;
      }

      return capturedOutput || "Code executed successfully (no output).";
    } catch (error) {
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  executionLock = currentExecution.catch(() => {});

  return currentExecution;
}

export { executeExecutePythonTool, executePythonTool };
