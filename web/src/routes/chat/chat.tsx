import { ArrowUpIcon, ChevronLeftIcon, ImageIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { authenticatedFetch } from "../../auth";
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
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: "assistant",
      content: GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    },
  ]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const [historyReady, setHistoryReady] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isStreaming) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function reload() {
      try {
        const response = await authenticatedFetch(`/api/chats/${id}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Failed to load chat history");
        const history: { messages: ChatMessage[]; active: boolean } = await response.json();
        if (controller.signal.aborted) return;
        if (history.messages.length) setMessages(history.messages);
        setActive(history.active);
        setHistoryReady(true);
        if (history.active) timer = setTimeout(reload, 1000);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Error loading chat history:", error);
        setHistoryReady(false);
      }
    }
    void reload();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [id, isStreaming]);

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
    if ((!input.trim() && images.length === 0) || isStreaming || active || !historyReady) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      images,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setImages([]);
    setHistoryReady(false);
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
      const response = await authenticatedFetch(`/api/chats/${id}`, {
        method: "POST",
        headers: {
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
    <main className="chat">
      <div ref={historyRef} className="history">
        <div className="messages">
          <button className="pill back" onClick={() => navigate(-1)}>
            <ChevronLeftIcon size={20} strokeWidth={2.25} />
            Takaisin
          </button>
          {messages.map((message, index) => {
            switch (message.role) {
              case "user":
                return (
                  <UserMessage key={index} content={message.content} images={message.images} />
                );
              case "assistant":
                if (message.content.trim() === "") return null;
                return <AssistantMessage key={index} content={message.content} />;
              case "tool-use":
                return <ToolUseMessage key={index} name={message.name} />;
              case "tool-result":
                return (
                  <details key={index}>
                    <summary>
                      {message.name}:{" "}
                      {
                        {
                          completed: "valmis",
                          failed: "epäonnistui",
                          pending: "kesken",
                          "not-executed": "ei suoritettu",
                        }[message.status]
                      }
                    </summary>
                    <pre>{message.content}</pre>
                  </details>
                );
              case "error":
                return (
                  <p key={index} className="error">
                    Vastauksen lähettäminen epäonnistui.
                  </p>
                );
            }
          })}
        </div>
      </div>
      {!historyReady && !isStreaming ? (
        <p>Keskustelun lataus kesken. Jos lataus epäonnistui, päivitä sivu ennen jatkamista.</p>
      ) : null}
      <div className="composer card">
        <textarea
          rows={1}
          aria-label="Viesti"
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
          <input
            accept="image/jpeg,image/png"
            multiple={true}
            ref={fileInputRef}
            style={{ display: "none" }}
            type="file"
            onChange={handleImageChange}
          />
          <button
            className="icon-button"
            aria-label="Liitä kuva"
            onClick={() => fileInputRef.current?.click()}
          >
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
          {images.length > 0 ? (
            <button className="attachments" onClick={() => setImages([])}>
              {images.length} kuva{images.length > 1 ? "a" : ""}
              <XIcon size={16} strokeWidth={2.25} />
            </button>
          ) : null}
          <button
            className="icon-button send"
            aria-label="Lähetä"
            onClick={sendMessage}
            disabled={
              !historyReady || active || isStreaming || (input.trim() === "" && images.length === 0)
            }
          >
            {isStreaming ? (
              <LoaderCircleIcon size={20} strokeWidth={2.25} />
            ) : (
              <ArrowUpIcon size={20} strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>
    </main>
  );
};

export { ChatRoute };
