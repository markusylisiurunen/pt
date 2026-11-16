import React from "react";

type FoodLogEntriesProps = {
  entries: {
    ts: string;
    label: string;
    kcal?: number;
    protein?: number;
  }[];
};
const FoodLogEntries: React.FC<FoodLogEntriesProps> = ({ entries }) => {
  function formatTime(ts: string): string {
    return new Date(ts)
      .toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", hour12: false })
      .replaceAll(".", ":");
  }
  function formatNumber(value: number | undefined): string {
    if (value === undefined) return "–";
    return value.toLocaleString("fi-FI", { maximumFractionDigits: 0, useGrouping: false });
  }
  return (
    <section className="card food-log">
      <header className="card-header">
        <h2>Syömiset</h2>
      </header>
      {entries.length === 0 ? (
        <p className="empty">Ei vielä merkintöjä tänään.</p>
      ) : (
        <ul className="rows">
          {entries.map((entry, index) => (
            <li key={index}>
              <span className="time">{formatTime(entry.ts)}</span>
              <span className="label">{entry.label}</span>
              <span className="kcal" title="kcal">
                {formatNumber(entry.kcal)}
              </span>
              <span className="protein" title="proteiini (g)">
                {formatNumber(entry.protein)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export { FoodLogEntries };
