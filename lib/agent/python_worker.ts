/// <reference lib="deno.worker" />

import { loadPyodide } from "pyodide";

self.onmessage = async (event: MessageEvent<{ code: string }>) => {
  try {
    const pyodide = await loadPyodide({ jsglobals: {}, stdout: () => {}, stderr: () => {} });
    const output: number[] = [];
    const stderr: number[] = [];
    const capture = (buffer: number[]) => (byte: number) => {
      if (output.length + stderr.length >= 32768) {
        throw new Error("Python output exceeded 32 KiB. Print a smaller result.");
      }
      buffer.push(byte);
    };
    pyodide.setStdout({ raw: capture(output) });
    pyodide.setStderr({ raw: capture(stderr) });
    const result = pyodide.runPython(event.data.code);
    if (result && typeof result.destroy === "function") result.destroy();
    const decoder = new TextDecoder();
    if (stderr.length) {
      throw new Error(`Python stderr:\n${decoder.decode(new Uint8Array(stderr))}`);
    }
    self.postMessage({
      result: decoder.decode(new Uint8Array(output)) || "Code executed successfully (no output).",
    });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
