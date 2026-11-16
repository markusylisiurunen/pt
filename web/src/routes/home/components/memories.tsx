import React from "react";

type MemoriesProps = {
  memories: string[];
};
const Memories: React.FC<MemoriesProps> = ({ memories }) => {
  function renderMemory(memory: string) {
    const match = memory.match(/(\d{4}-\d{2}-\d{2}):\s?(.+)/);
    if (!match) return <li key={memory}>{memory}</li>;

    const [, date, content] = match;
    const dateStr = new Date(date).toLocaleDateString("fi-FI", {
      year: "2-digit",
      month: "numeric",
      day: "numeric",
    });
    return (
      <li key={memory}>
        <span className="date">{dateStr}</span>
        {content}
      </li>
    );
  }
  return (
    <section className="card memories">
      <header className="card-header">
        <h2>Muistot</h2>
      </header>
      {memories.length === 0 ? (
        <p className="empty">Ei vielä muistoja.</p>
      ) : (
        <ul className="rows">{memories.map((memory) => renderMemory(memory))}</ul>
      )}
    </section>
  );
};

export { Memories };
