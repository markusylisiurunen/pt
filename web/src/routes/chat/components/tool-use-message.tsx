import { ParenthesesIcon } from "lucide-react";
import React from "react";

type ToolUseMessageProps = {
  name: string;
};
const ToolUseMessage: React.FC<ToolUseMessageProps> = ({ name }) => {
  return (
    <div className="tool-use-message">
      <ParenthesesIcon size={14} strokeWidth={2.25} />
      {name}
    </div>
  );
};

export { ToolUseMessage };
