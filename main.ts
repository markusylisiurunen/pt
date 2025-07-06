import { migrate } from "./lib/db.ts";
migrate();

import { z } from "zod";
import { Agent } from "./lib/agent.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const agent = new Agent(ANTHROPIC_API_KEY);

const chatPattern = new URLPattern({ pathname: "/api/chats/:id" });

export default {
  async fetch(req) {
    const url = new URL(req.url);

    const chatMatch = chatPattern.exec(url);
    if (chatMatch) {
      if (req.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }

      const id = chatMatch.pathname.groups["id"] as string;
      const { content } = z.object({ content: z.string() }).parse(await req.json());

      let answer = "";

      for await (const block of agent.send(id, content)) {
        if (answer.length > 0) answer += "\n\n";
        answer += block;
      }

      return new Response(JSON.stringify({ answer }), {
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies Deno.ServeDefaultExport;
