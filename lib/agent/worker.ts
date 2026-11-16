function runToolWorker<T>(
  url: URL,
  input: unknown,
  timeout: number,
  read: string[] = [],
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(url, {
      type: "module",
      deno: {
        permissions: {
          read,
          write: false,
          net: false,
          env: false,
          run: false,
          ffi: false,
          sys: false,
        },
      },
    });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(new Error(`Tool execution timed out after ${timeout / 1000} seconds.`));
    }, timeout);
    worker.onmessage = (event) => {
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      reject(new Error(event.message));
    };
    worker.postMessage(input);
  });
}

export { runToolWorker };
