import Anthropic from "@anthropic-ai/sdk";
import { loadPyodide } from "pyodide";
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

async function executeExecutePythonTool(input: unknown): Promise<string> {
  const inputSchema = z.object({
    code: z.string().min(1),
  });
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return "Error: Invalid input.";
  }

  try {
    const pyodide = await loadPyodide();

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

    if (capturedError) {
      return `Got a non-empty stderr output:\n${capturedError}`;
    }

    return capturedOutput || "Code executed successfully (no output).";
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export { executeExecutePythonTool, executePythonTool };
