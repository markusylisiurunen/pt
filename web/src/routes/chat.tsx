import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, SendIcon } from "lucide-react";
import React from "react";
import Markdown from "react-markdown";
import { useNavigate } from "react-router";

const ChatHistory: React.FC = () => {
  // prettier-ignore
  const MESSAGES: { role: 'user' | 'assistant'; content: string }[] = [
    { role: "user", content: "Hei!" },
    { role: "assistant", content: "Hei! Miten voin auttaa sinua tänään?" },
    { role: "user", content: "Miten treenaan rintalihaksia tehokkaasti?" },
    { role: "assistant", content: "Rintalihasten treenaamiseen on useita hyviä liikkeitä, kuten penkkipunnerrus, vinopenkkipunnerrus ja punnerrukset. Voit myös lisätä eristäviä liikkeitä, kuten ristikkäistaljassa tehtävät flyesit." },
  ];
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
      {MESSAGES.map((msg, index) => (
        <div
          key={index}
          className={cn(
            "mx-4",
            msg.role === "assistant" ? "" : undefined,
            msg.role === "user" ? "max-w-[80%] self-end rounded-md border p-2" : undefined,
          )}
        >
          <Markdown>{msg.content}</Markdown>
        </div>
      ))}
    </div>
  );
};

const ChatFooter: React.FC = () => {
  return (
    <div className="flex shrink-0 grow-0 gap-2 border-t px-4 py-4">
      <Input placeholder="Kysy mitä vain" />
      <Button size="icon">
        <SendIcon />
      </Button>
    </div>
  );
};

const ChatRoute: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex shrink-0 grow-0 border-b px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeftIcon />
          <span>Takaisin</span>
        </Button>
      </div>
      <ChatHistory />
      <ChatFooter />
    </div>
  );
};

export { ChatRoute };
