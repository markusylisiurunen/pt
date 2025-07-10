import { ParenthesesIcon } from "lucide-react";
import React from "react";

type ToolUseMessageProps = {
  name: string;
};
const ToolUseMessage: React.FC<ToolUseMessageProps> = ({ name }) => {
  return (
    <div className="tool-use-message">
      <div>
        <ParenthesesIcon size={16} strokeWidth={2.25} />
        <span>{name}</span>
      </div>
    </div>
  );
};

export { ToolUseMessage };
