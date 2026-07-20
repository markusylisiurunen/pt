import React from "react";
import type { ImageAttachment } from "../chat-events";

type UserMessageProps = {
  content: string;
  images: ImageAttachment[];
};
const UserMessage: React.FC<UserMessageProps> = ({ content, images }) => {
  return (
    <div className="user-message">
      {content.trim() === "" ? null : <p>{content}</p>}
      {images.length > 0 ? (
        <div>
          {images.map((image, index) => (
            <img key={index} src={image.base64Data} alt={`Image attachment ${index + 1}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export { UserMessage };
