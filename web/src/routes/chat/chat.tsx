import { ArrowUpIcon, ChevronLeftIcon, ImageIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import React, { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { getSafeAreaInsets } from "../../util/safe-area";
import "./chat.css";
import {
  applyAgentEvent,
  type ChatMessage,
  type ImageAttachment,
  readAgentEvents,
} from "./chat-events";
import { AssistantMessage } from "./components/assistant-message";
import { AudioButton } from "./components/audio-button";
import { ToolUseMessage } from "./components/tool-use-message";
import { UserMessage } from "./components/user-message";

const GREETINGS = [
  "Hei! Miten voin auttaa sinua?",
  "Terve! Mitä kuuluu, kerro vaan!",
  "Moi! Kerro mitä mietit, olen täällä sua varten.",
  "Hei siellä! Missä voin auttaa? Kysy rohkeasti!",
  "Tervehdys! Mitä tehdään tänään?",
  "Moro! Onko jotain kiinnostavaa mielessä?",
  "Hei! Mitä pohdit? Olen kuulolla!",
  "Terve! Kerro vaan mitä on mielessä.",
  "Moi! Miten menee? Toivottavasti hyvin!",
  "Hei! Mitä asiaa? Olen tässä apuna.",
];

const ChatRoute: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    },
  ]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const historyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newImages: ImageAttachment[] = [];
      for (let i = 0; i < files.length; i++) {
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push({
            mimeType: files[i].type,
            base64Data: reader.result as string,
          });
          if (newImages.length === files.length) {
            setImages((prev) => [...prev, ...newImages]);
          }
        };
        reader.readAsDataURL(files[i]);
      }
    }
  };

  async function sendMessage() {
    if ((!input.trim() && images.length === 0) || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      images,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setImages([]);
    setIsStreaming(true);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setTimeout(() => {
      if (!historyRef.current) return;
      historyRef.current.scrollTo({
        top: historyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 0);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/chats/${id}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          content: input,
          images: images.map((image) => ({
            mimeType: image.mimeType,
            base64Data: image.base64Data.split("base64,")[1],
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      for await (const event of readAgentEvents(response.body)) {
        setMessages((messages) => applyAgentEvent(messages, event));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((messages) => [...messages, { role: "error" }]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="chat-root">
      <div ref={historyRef} className="history">
        <div className="header">
          <button id="back" onClick={() => navigate(-1)}>
            <ChevronLeftIcon size={20} strokeWidth={2.25} />
            <span>Takaisin</span>
          </button>
        </div>
        {messages.map((message, index) => {
          const spacer = index > 0 ? <div style={{ height: 16 }} /> : null;
          switch (message.role) {
            case "user":
              return (
                <React.Fragment key={message.role + "-" + index}>
                  {spacer}
                  <UserMessage content={message.content} images={message.images} />
                </React.Fragment>
              );
            case "assistant":
              if (message.content.trim() === "") {
                return null;
              }
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
            case "error":
              return (
                <React.Fragment key={message.role + "-" + index}>
                  {spacer}
                  <div className="chat-error">Vastauksen lähettäminen epäonnistui.</div>
                </React.Fragment>
              );
          }
        })}
      </div>
      <div className="inputbox" style={{ marginBlockEnd: getSafeAreaInsets().bottom > 0 ? 0 : 12 }}>
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
          <div>
            {images.length > 0 ? (
              <button id="clear-attached" onClick={() => setImages([])}>
                <span>
                  {images.length} kuva{images.length > 1 ? "a" : ""}
                </span>
                <XIcon size={16} strokeWidth={2} />
              </button>
            ) : null}
          </div>
          <div>
            <input
              accept="image/jpeg,image/png"
              multiple={true}
              ref={fileInputRef}
              style={{ display: "none" }}
              type="file"
              onChange={handleImageChange}
            />
            <button id="attach" onClick={() => fileInputRef.current?.click()}>
              <ImageIcon size={20} strokeWidth={2} />
            </button>
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
                <LoaderCircleIcon size={20} strokeWidth={2.25} />
              ) : (
                <ArrowUpIcon size={20} strokeWidth={2.25} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ChatRoute };
