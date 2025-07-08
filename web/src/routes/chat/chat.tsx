import { ArrowUpIcon, SquareIcon } from "lucide-react";
import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import "./chat.css";
import { AssistantMessage } from "./components/assistant-message";
import { AudioButton } from "./components/audio-button";
import { ToolUseMessage } from "./components/tool-use-message";
import { UserMessage } from "./components/user-message";

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool-use"; name: string };

const ChatRoute: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  async function sendMessage() {
    if (!input.trim() || isStreaming) return;

    const userMessage = { role: "user" as const, content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/chats/${id}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ content: input }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      let currentAssistantMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const event = JSON.parse(data);
              if (event.type === "content_delta") {
                currentAssistantMessage += event.content;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.role === "assistant") {
                    lastMessage.content = currentAssistantMessage;
                  } else {
                    newMessages.push({ role: "assistant", content: currentAssistantMessage });
                  }
                  return newMessages;
                });
              } else if (event.type === "tool_use") {
                if (currentAssistantMessage) {
                  setMessages((prev) => [
                    ...prev,
                    { role: "assistant", content: currentAssistantMessage },
                  ]);
                  currentAssistantMessage = "";
                }
                setMessages((prev) => [...prev, { role: "tool-use", name: event.name }]);
              }
            } catch (e) {
              console.error("Failed to parse event:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="chat-root">
      <button onClick={() => navigate(-1)}>Takaisin</button>
      <div className="history">
        {messages.map((message, index) => {
          const spacer = index > 0 ? <div style={{ height: 16 }} /> : null;
          switch (message.role) {
            case "user":
              return (
                <React.Fragment key={message.role + "-" + index}>
                  {spacer}
                  <UserMessage content={message.content} />
                </React.Fragment>
              );
            case "assistant":
              return (
                <React.Fragment key={message.role + "-" + index}>
                  {spacer}
                  <AssistantMessage content={message.content} />
                </React.Fragment>
              );
            case "tool-use":
              return (
                <React.Fragment key={message.role + "-" + index}>
                  {spacer}
                  <ToolUseMessage name={message.name} />
                </React.Fragment>
              );
            default:
              return null;
          }
        })}
      </div>
      <div className="footer">
        <div className="input-container">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Kirjoita mitä vain"
          />
          <div className="actions">
            <AudioButton
              onTranscript={(transcript) =>
                setInput((input) => (input.trim() + "\n\n" + transcript).trim())
              }
              onError={(error) => {
                alert(`${error.message} (${error.type})`);
              }}
            />
            <button id="send" onClick={sendMessage} disabled={isStreaming}>
              {isStreaming ? (
                <SquareIcon size={19} strokeWidth={2} />
              ) : (
                <ArrowUpIcon size={19} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ChatRoute };
