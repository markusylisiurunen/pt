type ImageAttachment = {
  mimeType: string;
  base64Data: string;
};

type ChatMessage =
  | { role: "user"; content: string; images: ImageAttachment[] }
  | { role: "assistant"; content: string }
  | { role: "tool-use"; name: string }
  | { role: "error" };

type AgentEvent =
  | { type: "content_delta"; content: string }
  | { type: "tool_use"; name: string }
  | { type: "error" };

const DONE = Symbol("done");

function parseEventLine(line: string): AgentEvent | typeof DONE | null {
  if (line.endsWith("\r")) {
    line = line.slice(0, -1);
  }
  if (line === "") {
    return null;
  }
  if (!line.startsWith("data: ")) {
    throw new Error("Invalid chat event");
  }

  const data = line.slice(6);
  if (data === "[DONE]") {
    return DONE;
  }

  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error("Invalid chat event");
  }
  if (typeof value !== "object" || value === null || !("type" in value)) {
    throw new Error("Invalid chat event");
  }

  if (
    value.type === "content_delta" &&
    "content" in value &&
    typeof value.content === "string"
  ) {
    return { type: "content_delta", content: value.content };
  }
  if (value.type === "tool_use" && "name" in value && typeof value.name === "string") {
    return { type: "tool_use", name: value.name };
  }
  if (value.type === "error") {
    return { type: "error" };
  }
  throw new Error("Invalid chat event");
}

async function* readAgentEvents(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let complete = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        pending += decoder.decode();
        break;
      }

      pending += decoder.decode(value, { stream: true });
      let newlineIndex = pending.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = pending.slice(0, newlineIndex);
        pending = pending.slice(newlineIndex + 1);
        const event = parseEventLine(line);
        if (event === DONE) {
          complete = true;
          return;
        }
        if (event) {
          yield event;
        }
        newlineIndex = pending.indexOf("\n");
      }
    }

    if (pending !== "") {
      const event = parseEventLine(pending);
      if (event === DONE) {
        complete = true;
        return;
      }
      if (event) {
        yield event;
      }
    }
    throw new Error("Chat response ended unexpectedly");
  } finally {
    if (!complete) {
      await reader.cancel();
    }
    reader.releaseLock();
  }
}

function applyAgentEvent(messages: ChatMessage[], event: AgentEvent): ChatMessage[] {
  if (event.type === "content_delta") {
    const lastMessage = messages.at(-1);
    if (lastMessage?.role === "assistant") {
      return [
        ...messages.slice(0, -1),
        { role: "assistant", content: lastMessage.content + event.content },
      ];
    }
    return [...messages, { role: "assistant", content: event.content }];
  }
  if (event.type === "tool_use") {
    return [...messages, { role: "tool-use", name: event.name }];
  }
  throw new Error("Chat request failed");
}

export {
  applyAgentEvent,
  type AgentEvent,
  type ChatMessage,
  type ImageAttachment,
  readAgentEvents,
};
