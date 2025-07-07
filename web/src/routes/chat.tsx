import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, SendIcon } from "lucide-react";
import React, { useState } from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";

type AgentEvent = { type: "content_delta"; content: string } | { type: "tool_use"; name: string };

type ChatHistoryProps = {
  messages: {
    role: "user" | "assistant";
    content: string;
  }[];
};
const ChatHistory: React.FC<ChatHistoryProps> = ({ messages }) => {
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={cn(
            "markdown",
            "mx-4",
            msg.role === "assistant" ? "" : undefined,
            msg.role === "user" ? "max-w-[80%] self-end rounded-lg border p-2" : undefined,
          )}
        >
          <Markdown>{msg.content}</Markdown>
        </div>
      ))}
    </div>
  );
};

type ChatFooterProps = {
  onSend: (content: string) => void;
};
const ChatFooter: React.FC<ChatFooterProps> = ({ onSend }) => {
  const [input, setInput] = useState("");

  function handleSend() {
    onSend(input);
    setInput("");
  }

  return (
    <div className="flex shrink-0 grow-0 gap-2 border-t px-4 py-4">
      <Input
        placeholder="Kysy mitä vain"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button
        size="icon"
        onClick={() => {
          if (input.trim() === "") return;
          handleSend();
        }}
      >
        <SendIcon />
      </Button>
    </div>
  );
};

const ChatRoute: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatHistoryProps["messages"]>([]);

  async function sendChatMessage(content: string) {
    setMessages((prev) => [...prev, { role: "user", content }]);

    let assistantMessage = "";

    try {
      const response = await fetch("/api/chats/1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              break;
            }

            try {
              const event: AgentEvent = JSON.parse(data);

              if (event.type === "content_delta") {
                assistantMessage += event.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  if (newMessages[newMessages.length - 1]?.role === "assistant") {
                    newMessages[newMessages.length - 1].content = assistantMessage;
                  } else {
                    newMessages.push({ role: "assistant", content: assistantMessage });
                  }
                  return newMessages;
                });
              } else if (event.type === "tool_use") {
                const toolMessage = `\`${event.name}\` was used.`;
                assistantMessage += "\n\n" + toolMessage + "\n\n";
                setMessages((prev) => {
                  const newMessages = [...prev];
                  if (newMessages[newMessages.length - 1]?.role === "assistant") {
                    newMessages[newMessages.length - 1].content = assistantMessage;
                  } else {
                    newMessages.push({ role: "assistant", content: assistantMessage });
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              console.error("Failed to parse event:", data, e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error streaming response:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Failed to get response" },
      ]);
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex shrink-0 grow-0 border-b px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
          <span>Takaisin</span>
        </Button>
      </div>
      <ChatHistory messages={messages} />
      <ChatFooter onSend={(content) => void sendChatMessage(content)} />
    </div>
  );
};

export { ChatRoute };
