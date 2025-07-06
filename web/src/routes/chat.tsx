import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, SendIcon } from "lucide-react";
import React, { useState } from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";

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
    const response = await fetch("/api/chats/1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await response.json();
    setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
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
