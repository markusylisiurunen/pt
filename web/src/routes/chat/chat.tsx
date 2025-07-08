import { ArrowUpIcon, AudioLinesIcon } from "lucide-react";
import React from "react";
import "./chat.css";
import { AssistantMessage } from "./components/assistant-message";
import { ToolUseMessage } from "./components/tool-use-message";
import { UserMessage } from "./components/user-message";

const MESSAGES = [
  { role: "user", content: "Hei, miten menee?" },
  { role: "assistant", content: "Hei! Hyvin menee, kiitos kysymästä. Entä sinä?" },
  { role: "tool-use", name: "ReadDocument" },
  { role: "assistant", content: "Olen lukenut dokumentin, ja se käsittelee asiaa X." },
] as const;

const ChatRoute: React.FC = () => {
  return (
    <div className="chat-root">
      <div className="history">
        {MESSAGES.map((message, index) => {
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
          <textarea placeholder="Kirjoita mitä vain"></textarea>
          <div className="actions">
            <button id="audio">
              <AudioLinesIcon size={19} strokeWidth={2} />
            </button>
            <button id="send">
              <ArrowUpIcon size={19} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ChatRoute };
