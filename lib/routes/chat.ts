import z from "zod";
import { Agent } from "../agent/agent.ts";

interface Route {
  (req: Request): Response | Promise<Response>;
}

function chatRoute(agent: Agent, id: string): Route {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    const bodySchema = z.object({
      content: z.string(),
      images: z
        .array(
          z.object({
            mimeType: z.enum(["image/jpeg", "image/png"]),
            base64Data: z.string().min(1),
          }),
        )
        .optional(),
    });
    const parsedBody = bodySchema.safeParse(await req.json());
    if (!parsedBody.success) {
      return new Response("Invalid payload", { status: 400 });
    }
    const stream = new ReadableStream({
      async start(controller) {
        const content = parsedBody.data.content;
        const images = parsedBody.data.images;
        try {
          for await (const event of agent.send(id, content, images)) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream" } });
  };
}

export { chatRoute };
