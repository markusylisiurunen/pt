import { loadPyodide } from "pyodide";

const { code }: { code: string } = await new Response(Deno.stdin.readable).json();
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
  const result = pyodide.runPython(code);
  if (result && typeof result.destroy === "function") result.destroy();
  const decoder = new TextDecoder();
  if (stderr.length) {
    throw new Error(`Python stderr:\n${decoder.decode(new Uint8Array(stderr))}`);
  }
  console.log(JSON.stringify({
    result: decoder.decode(new Uint8Array(output)) || "Code executed successfully (no output).",
  }));
} catch (error) {
  console.log(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
}
