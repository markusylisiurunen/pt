import React from "react";

type UserMessageProps = {
  content: string;
};
const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
  return (
    <div className="user-message">
      <p>{content}</p>
    </div>
  );
};

export { UserMessage };
