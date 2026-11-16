import React from "react";

type IntakeCardProps = {
  heading: string;
  unit: string;
  subject: "kcal" | "protein";
  current: number;
  target: number;
  // Calories are a ceiling to stay under, protein a minimum to reach.
  goal: "max" | "min";
  maximumFractionDigits: number;
};

// A half circle drawn left to right over the top, in a 160 × 87 view box.
const ARCH_STROKE = 14;
const ARCH_RADIUS = (160 - ARCH_STROKE) / 2;
const ARCH_PATH = `M ${ARCH_STROKE / 2} ${ARCH_RADIUS + ARCH_STROKE / 2} a ${ARCH_RADIUS} ${ARCH_RADIUS} 0 0 1 ${2 * ARCH_RADIUS} 0`;

const IntakeCard: React.FC<IntakeCardProps> = ({
  heading,
  unit,
  subject,
  current,
  target,
  goal,
  maximumFractionDigits,
}) => {
  function formatNumber(value: number): string {
    return value.toLocaleString("fi-FI", { maximumFractionDigits, useGrouping: false });
  }

  const progress = target > 0 ? Math.min(current / target, 1) : 0;
  const remaining = target - current;
  let status: string;
  if (remaining > 0) {
    status = `${formatNumber(remaining)} jäljellä`;
  } else if (remaining < 0 && goal === "max") {
    status = `${formatNumber(-remaining)} yli`;
  } else {
    status = "Tavoite täynnä";
  }

  return (
    <section className={`card intake-card subject-${subject}`}>
      <header className="card-header">
        <h2>{heading}</h2>
        <span>{unit}</span>
      </header>
      <div className="gauge">
        <svg viewBox={`0 0 160 ${ARCH_RADIUS + ARCH_STROKE}`} aria-hidden="true">
          <path className="track" d={ARCH_PATH} strokeWidth={ARCH_STROKE} />
          {progress > 0 ? (
            <path
              className="progress"
              d={ARCH_PATH}
              pathLength={100}
              strokeDasharray={`${progress * 100} 100`}
              strokeWidth={ARCH_STROKE}
            />
          ) : null}
        </svg>
        <span className="value">{formatNumber(current)}</span>
      </div>
      <span className="target">/ {formatNumber(target)}</span>
      <span className="chip">{status}</span>
    </section>
  );
};

export { IntakeCard };
