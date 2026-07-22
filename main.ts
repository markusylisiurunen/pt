import { serveDir } from "@std/http";
import { chatRoute } from "./lib/routes/chat.ts";
import { configRoute } from "./lib/routes/config.ts";
import { docsRoute } from "./lib/routes/docs.ts";
import { exportRoute } from "./lib/routes/export.ts";
import { importRoute } from "./lib/routes/import.ts";
import { transcribeRoute } from "./lib/routes/transcribe.ts";
import { userRoute } from "./lib/routes/user.ts";
import { authenticateUser, closeUserRuntimes, createUserRuntimes } from "./lib/user_runtimes.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

const runtimes = createUserRuntimes({
  users: Deno.env.get("USERS"),
  password: Deno.env.get("PASSWORD"),
  dataFolder: Deno.env.get("DATA_FOLDER") || ".",
  anthropicApiKey: ANTHROPIC_API_KEY,
  geminiApiKey: GEMINI_API_KEY,
});

addEventListener("unload", () => closeUserRuntimes(runtimes));

const chatPattern = new URLPattern({ pathname: "/api/chats/:id" });
const configPattern = new URLPattern({ pathname: "/api/config" });
const docsPattern = new URLPattern({ pathname: "/api/docs/:slug" });
const exportPattern = new URLPattern({ pathname: "/api/export" });
const importPattern = new URLPattern({ pathname: "/api/import" });
const transcribePattern = new URLPattern({ pathname: "/api/transcribe" });
const userPattern = new URLPattern({ pathname: "/api/user" });

export default {
  async fetch(req) {
    const url = new URL(req.url);

    if (!url.pathname.startsWith("/api/")) {
      const response = await serveDir(req, { fsRoot: "./web/dist" });
      if (response.status === 404 && !url.pathname.includes(".")) {
        return serveDir(new Request(new URL("/", req.url)), { fsRoot: "./web/dist" });
      }
      return response;
    }

    const runtime = authenticateUser(runtimes, req.headers.get("authorization"));
    if (!runtime) {
      return new Response("Unauthorized", { status: 401 });
    }

    const chatMatch = chatPattern.exec(url);
    if (chatMatch) return chatRoute(runtime.agent, chatMatch.pathname.groups["id"] ?? "")(req);

    const configMatch = configPattern.exec(url);
    if (configMatch) return configRoute(runtime.db)(req);

    const docsMatch = docsPattern.exec(url);
    if (docsMatch) return docsRoute(runtime.db, docsMatch.pathname.groups["slug"] ?? "")(req);

    const exportMatch = exportPattern.exec(url);
    if (exportMatch) return exportRoute(runtime.db, runtime.password)(req);

    const importMatch = importPattern.exec(url);
    if (importMatch) return importRoute(runtime.db)(req);

    const transcribeMatch = transcribePattern.exec(url);
    if (transcribeMatch) return transcribeRoute(runtime.db, GEMINI_API_KEY)(req);

    const userMatch = userPattern.exec(url);
    if (userMatch) return userRoute(runtime.db, runtime.name)(req);

    return new Response("Not found", { status: 404 });
  },
} satisfies Deno.ServeDefaultExport;
