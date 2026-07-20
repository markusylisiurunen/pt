import z from "zod";
import { Agent } from "../agent/agent.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

type ChatAgent = Pick<Agent, "send">;

const bodySchema = z
  .object({
    content: z.string(),
    images: z.array(
      z.object({
        mimeType: z.enum(["image/jpeg", "image/png"]),
        base64Data: z.string().min(1),
      }),
    ),
  })
  .refine(({ content, images }) => content.trim() !== "" || images.length > 0);

function chatRoute(agent: ChatAgent, id: string): Route {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return new Response("Invalid payload", { status: 400 });
    }

    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      return new Response("Invalid payload", { status: 400 });
    }

    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (
            const event of agent.send(
              id,
              parsedBody.data.content,
              parsedBody.data.images,
            )
          ) {
            if (cancelled) return;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          }
          if (cancelled) return;
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          if (cancelled) return;
          console.error("Chat error:", error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error" })}\n\n`));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
      cancel() {
        cancelled = true;
      },
    });
    return new Response(stream, {
      headers: {
        "cache-control": "no-cache",
        "content-type": "text/event-stream; charset=utf-8",
      },
    });
  };
}

export { chatRoute };
