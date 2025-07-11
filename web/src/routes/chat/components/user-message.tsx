import React from "react";

type UserMessageProps = {
  content: string;
  images?: { mimeType: string; base64Data: string }[];
};
const UserMessage: React.FC<UserMessageProps> = ({ content, images }) => {
  return (
    <div className="user-message">
      <p>{content}</p>
      {images && images.length > 0 ? (
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
