import React from "react";

type IntakeCardProps = {
  heading: string;
  current: number;
  target: number;
  unit: string;
  maximumFractionDigits?: number;
};
const IntakeCard: React.FC<IntakeCardProps> = ({
  heading,
  current,
  target,
  unit,
  maximumFractionDigits,
}) => {
  function formatNumber(v: number): string {
    return v
      .toLocaleString("fi-FI", {
        maximumFractionDigits: maximumFractionDigits ?? 1,
      })
      .replace(/\s/, "")
      .trim();
  }
  return (
    <div className="intake-card">
      <div className="header">
        <h3>{heading}</h3>
        <span>({unit})</span>
      </div>
      <div className="intake-values">
        <span>{formatNumber(current)}</span>
        <span>/</span>
        <span>{formatNumber(target)}</span>
      </div>
      <div className="intake-progress">
        <div
          style={{
            background: "var(--color-border-accent)",
            width: `${Math.min((current / target) * 100, 100)}%`,
          }}
        />
      </div>
    </div>
  );
};

export { IntakeCard };
