import React, { useState } from "react";
import {
  addDays,
  calculateSmoothWeightHistory,
  daysBetween,
  getHelsinkiDate,
} from "../../../util/transform";
import { WeightForm } from "./weight-form";

// Longer ranges average over more days so day-to-day noise doesn't hide the trend.
const RANGES = [
  { days: 91, label: "3 kk", smoothingDays: 1 },
  { days: 182, label: "6 kk", smoothingDays: 3 },
  { days: 365, label: "1 v", smoothingDays: 7 },
  { days: 3 * 365, label: "3 v", smoothingDays: 7 },
];
const RANGE_STORAGE_KEY = "weightRangeDays";
// Measurements further apart than this are drawn as separate lines with a gap between them.
const MAX_CONNECTED_GAP_DAYS = 10;

function readSavedRange() {
  const days = Number(window.localStorage.getItem(RANGE_STORAGE_KEY));
  return RANGES.find((range) => range.days === days) ?? RANGES[1];
}

function splitAtGaps(entries: { date: string; weight: number }[]) {
  const runs: { date: string; weight: number }[][] = [];
  for (const entry of entries) {
    const run = runs.at(-1);
    const previous = run?.at(-1);
    if (run && previous && daysBetween(previous.date, entry.date) <= MAX_CONNECTED_GAP_DAYS) {
      run.push(entry);
    } else {
      runs.push([entry]);
    }
  }
  return runs;
}

function formatDate(date: string, today: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: date.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    timeZone: "UTC",
  });
}

function formatWeight(weight: number): string {
  return weight.toLocaleString("fi-FI", { maximumFractionDigits: 1 });
}

type WeightCardProps = {
  now: string;
  history: { date: string; weight: number }[];
  targetDate: string;
  targetWeight: number;
  onSaved: (entry: { date: string; weight: number }) => void;
};

const WeightCard: React.FC<WeightCardProps> = ({
  now,
  history,
  targetDate,
  targetWeight,
  onSaved,
}) => {
  const [range, setRange] = useState(readSavedRange);

  function selectRange(next: (typeof RANGES)[number]) {
    setRange(next);
    window.localStorage.setItem(RANGE_STORAGE_KEY, String(next.days));
  }

  const today = getHelsinkiDate(now);
  const targetDay = getHelsinkiDate(targetDate);
  const measurements = history.filter((entry) => entry.date <= today);
  const latest = measurements.at(-1);
  const currentWeight = latest?.weight ?? null;
  const isStale = latest !== undefined && daysBetween(latest.date, today) > 1;

  // The chart starts at the range start, or at the first weigh-in for a newer history.
  const rangeStart = addDays(today, -range.days);
  const inRange = measurements.filter((entry) => entry.date >= rangeStart);
  const startDay =
    measurements[0] !== undefined && measurements[0].date >= rangeStart
      ? measurements[0].date
      : rangeStart;
  const runs = splitAtGaps(inRange).map((run) =>
    calculateSmoothWeightHistory(run, range.smoothingDays),
  );
  const lastObserved = runs.at(-1)?.at(-1);

  // The projection runs from today to the target, cut off where the chart ends.
  // Without weigh-ins in the range there's nothing to project from on this chart.
  const hasProjection = currentWeight !== null && targetDay > today && runs.length > 0;
  const chartLimit = addDays(today, range.days);
  const endDay = !hasProjection ? today : targetDay < chartLimit ? targetDay : chartLimit;
  const projectedEndWeight = hasProjection
    ? currentWeight +
      ((targetWeight - currentWeight) * daysBetween(today, endDay)) / daysBetween(today, targetDay)
    : null;
  const weeklyChange =
    currentWeight !== null && targetDay > today
      ? ((targetWeight - currentWeight) / daysBetween(today, targetDay)) * 7
      : null;

  // Positions are percentages of the chart, so lines and markers scale with its width.
  const weights = runs.flat().map((entry) => entry.weight);
  if (currentWeight !== null) weights.push(currentWeight);
  if (projectedEndWeight !== null) weights.push(projectedEndWeight);
  const span = Math.max(Math.max(...weights) - Math.min(...weights), 2);
  const middle = (Math.max(...weights) + Math.min(...weights)) / 2;
  const top = middle + span * 0.6;
  const totalDays = Math.max(daysBetween(startDay, endDay), 1);
  const x = (date: string) => (daysBetween(startDay, date) / totalDays) * 100;
  const y = (weight: number) => ((top - weight) / (span * 1.2)) * 100;
  // Whole-kilogram gridlines, spaced so a few fit in the chart.
  const gridStep = span <= 4 ? 1 : span <= 10 ? 2 : 5;
  const gridWeights: number[] = [];
  for (let w = Math.ceil((top - span * 1.2) / gridStep) * gridStep; w <= top; w += gridStep) {
    gridWeights.push(w);
  }

  return (
    <section className="card weight-card subject-weight">
      <header className="card-header">
        <h2>Paino</h2>
        <span>
          {targetDay > today
            ? `${formatWeight(targetWeight)} kg ${formatDate(targetDay, today)} mennessä`
            : `Tavoite ${formatWeight(targetWeight)} kg`}
        </span>
      </header>
      {currentWeight === null || latest === undefined ? (
        <p className="empty">Ei vielä punnituksia.</p>
      ) : (
        <>
          <div className="summary">
            <div>
              <span className="value">
                {formatWeight(currentWeight)}
                <span className="unit">kg</span>
              </span>
              {isStale ? (
                <p className="measured">Punnittu {formatDate(latest.date, today)}</p>
              ) : null}
            </div>
            {weeklyChange !== null ? (
              <span className="chip">
                {weeklyChange.toLocaleString("fi-FI", {
                  maximumFractionDigits: 1,
                  signDisplay: "exceptZero",
                })}{" "}
                kg / vko
              </span>
            ) : null}
          </div>
          <div className="chart">
            {gridWeights.map((weight) => (
              <span key={weight} className="gridline" style={{ top: `${y(weight)}%` }}>
                <span>{weight}</span>
              </span>
            ))}
            <div className="plot">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line className="today" x1={x(today)} x2={x(today)} y1={0} y2={100} />
                {projectedEndWeight !== null ? (
                  <line
                    className="projection"
                    x1={x(today)}
                    x2={x(endDay)}
                    y1={y(currentWeight)}
                    y2={y(projectedEndWeight)}
                  />
                ) : null}
                {runs.slice(1).map((run, index) => {
                  const before = runs[index].at(-1)!;
                  return (
                    <line
                      key={run[0].date}
                      className="gap"
                      x1={x(before.date)}
                      x2={x(run[0].date)}
                      y1={y(before.weight)}
                      y2={y(run[0].weight)}
                    />
                  );
                })}
                {runs.map((run) => (
                  <polyline
                    key={run[0].date}
                    className="observed"
                    points={run.map((entry) => `${x(entry.date)},${y(entry.weight)}`).join(" ")}
                  />
                ))}
              </svg>
              {lastObserved ? (
                <span
                  className="marker current"
                  style={{ left: `${x(lastObserved.date)}%`, top: `${y(lastObserved.weight)}%` }}
                />
              ) : null}
              {hasProjection && targetDay === endDay ? (
                <span
                  className="marker target"
                  style={{ left: `${x(targetDay)}%`, top: `${y(targetWeight)}%` }}
                />
              ) : null}
            </div>
            {runs.length === 0 ? <p className="empty">Ei punnituksia tällä aikavälillä.</p> : null}
          </div>
          <div className="dates">
            <span>{formatDate(startDay, today)}</span>
            {range.smoothingDays > 1 ? <span>{range.smoothingDays} pv keskiarvo</span> : null}
            <span>{formatDate(endDay, today)}</span>
          </div>
          <div className="controls">
            <div className="segmented" role="group" aria-label="Aikaväli">
              {RANGES.map((option) => (
                <button
                  key={option.days}
                  type="button"
                  aria-pressed={range.days === option.days}
                  onClick={() => selectRange(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
      <WeightForm onSaved={onSaved} />
    </section>
  );
};

export { WeightCard };
