import { fileURLToPath } from "node:url";

async function runToolProcess<T>(
  url: URL,
  input: unknown,
  timeout: number,
  read: string[] = [],
): Promise<T> {
  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--cached-only",
      "--no-prompt",
      "--config",
      fileURLToPath(new URL("../../deno.json", import.meta.url)),
      read.length ? `--allow-read=${read.join(",")}` : "--deny-read",
      "--deny-write",
      "--deny-net",
      "--deny-env",
      "--deny-run",
      "--deny-ffi",
      "--deny-sys",
      url.href,
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  let exited = false;
  const status = child.status.then((status) => {
    exited = true;
    return status;
  });
  const kill = () => {
    if (exited) return;
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) throw error;
    }
  };
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    kill();
  }, timeout);
  try {
    const [, output] = await Promise.all([
      new Response(JSON.stringify(input)).body!.pipeTo(child.stdin),
      child.output(),
    ]);
    if (timedOut) throw new Error("Timed out.");
    if (!output.success) {
      throw new Error(new TextDecoder().decode(output.stderr).trim() || "Tool process failed.");
    }
    const response = JSON.parse(new TextDecoder().decode(output.stdout));
    if (response.error) throw new Error(response.error);
    return response.result;
  } catch (error) {
    if (timedOut) {
      throw new Error(`Tool execution timed out after ${timeout / 1000} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    kill();
    await status;
  }
}

export { runToolProcess };
