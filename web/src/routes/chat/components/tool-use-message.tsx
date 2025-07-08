import { WrenchIcon } from "lucide-react";
import React from "react";

type ToolUseMessageProps = {
  name: string;
};
const ToolUseMessage: React.FC<ToolUseMessageProps> = ({ name }) => {
  return (
    <div className="tool-use-message">
      <div>
        <WrenchIcon size={16} strokeWidth={2} opacity={0.5} />
        <span>{name}</span>
      </div>
    </div>
  );
};

export { ToolUseMessage };
