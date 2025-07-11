import React from "react";

type FoodLogEntriesProps = {
  entries: {
    ts: string;
    label: string;
    kcal: number;
    protein: number;
  }[];
};
const FoodLogEntries: React.FC<FoodLogEntriesProps> = ({ entries }) => {
  function formatDate(dateStr: string): string {
    return new Date(dateStr)
      .toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", hour12: false })
      .replaceAll(".", ":");
  }
  function formatNumber(value: number): string {
    return value.toLocaleString("fi-FI", { maximumFractionDigits: 0 });
  }
  return (
    <div className="food-log-entries">
      <div className="header">
        <h3>Syömiset</h3>
        <span>kcal/prot.</span>
      </div>
      <div className="entries">
        {entries.map((entry, index) => (
          <React.Fragment key={index}>
            <span>
              <span>{formatDate(entry.ts) + " "}</span>
              <span>{entry.label}</span>
            </span>
            <span>
              {formatNumber(entry.kcal)}/{formatNumber(entry.protein)}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export { FoodLogEntries };
