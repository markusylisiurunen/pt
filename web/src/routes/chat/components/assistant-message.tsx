import React from "react";
import Markdown from "react-markdown";

type AssistantMessageProps = {
  content: string;
};
const AssistantMessage: React.FC<AssistantMessageProps> = ({ content }) => {
  return (
    <div className="assistant-message md">
      <Markdown>{content}</Markdown>
    </div>
  );
};

export { AssistantMessage };
