import React from "react";

type MemoriesProps = {
  memories: string[];
};
const Memories: React.FC<MemoriesProps> = ({ memories }) => {
  function renderMemory(memory: string) {
    const dateRegex = /(\d{4}-\d{2}-\d{2}):\s?(.+)/;
    const match = memory.match(dateRegex);
    if (!match) {
      return (
        <React.Fragment key={memory}>
          <span />
          <span>{memory}</span>
        </React.Fragment>
      );
    }
    const [, date, content] = match;
    type Opts = Intl.DateTimeFormatOptions;
    const options: Opts = { year: "2-digit", month: "2-digit", day: "2-digit" };
    const dateStr = new Date(date).toLocaleDateString("fi-FI", options);
    return (
      <React.Fragment key={memory}>
        <span>{dateStr}</span>
        <span>{content}</span>
      </React.Fragment>
    );
  }
  return (
    <div className="memories">
      <div className="header">
        <h3>Muistot</h3>
      </div>
      <div className="entries">{memories.map((memory) => renderMemory(memory))}</div>
    </div>
  );
};

export { Memories };
