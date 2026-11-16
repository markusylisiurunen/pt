import React from "react";
import { addDays, getHelsinkiDate } from "../../../util/transform";

const HISTORY_DAYS = 14;
// Days within this many kcal of the target count as on target.
const ON_TARGET_KCAL = 50;
// Days logged below this share of the target were most likely only partly logged.
const PARTIAL_DAY_SHARE = 0.4;

const Bar: React.FC<{ diff: number; maxDiff: number }> = ({ diff, maxDiff }) => (
  <span
    className="bar"
    style={{ "--size": Math.min(Math.abs(diff) / maxDiff, 1) } as React.CSSProperties}
  />
);

type IntakeHistoryProps = {
  now: string;
  target: number;
  history: {
    date: string;
    kcal: number;
  }[];
};
const IntakeHistory: React.FC<IntakeHistoryProps> = ({ now, target, history }) => {
  const today = getHelsinkiDate(now);
  const kcalByDate = new Map(history.map((entry) => [entry.date, entry.kcal]));
  const days = Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const date = addDays(today, index - HISTORY_DAYS);
    const kcal = kcalByDate.get(date);
    return {
      date,
      diff: kcal === undefined ? null : Math.round(kcal - target),
      partial: kcal !== undefined && kcal < target * PARTIAL_DAY_SHARE,
    };
  });
  // Partly logged days would drag the average down, so it only counts complete days.
  const loggedDiffs = days.flatMap((day) => (day.diff === null || day.partial ? [] : [day.diff]));
  const maxDiff = Math.max(...loggedDiffs.map(Math.abs), ON_TARGET_KCAL);
  const averageDiff = loggedDiffs.reduce((sum, diff) => sum + diff, 0) / loggedDiffs.length;

  function formatDate(date: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("fi-FI", {
      day: "numeric",
      month: "numeric",
      timeZone: "UTC",
    });
  }

  function formatDiff(diff: number): string {
    return diff.toLocaleString("fi-FI", { signDisplay: "always", useGrouping: false });
  }

  return (
    <section className="card intake-history">
      <header className="card-header">
        <h2>Kalorit, 2 viikkoa</h2>
        {loggedDiffs.length > 0 ? (
          <span>ka. {formatDiff(Math.round(averageDiff))} kcal / pv</span>
        ) : null}
      </header>
      {days.every((day) => day.diff === null) ? (
        <p className="empty">Ei kirjauksia kahteen viikkoon.</p>
      ) : (
        <>
          <ol className="days">
            {days.map(({ date, diff, partial }) => {
              if (diff === null) {
                return (
                  <li key={date} className="missing" title={`${formatDate(date)}: ei kirjauksia`}>
                    <span className="dot" />
                  </li>
                );
              }
              if (Math.abs(diff) <= ON_TARGET_KCAL) {
                return (
                  <li key={date} className="on-target" title={`${formatDate(date)}: tavoitteessa`}>
                    <span className="dot" />
                  </li>
                );
              }
              return (
                <li
                  key={date}
                  className={partial ? "under partial" : diff > 0 ? "over" : "under"}
                  title={`${formatDate(date)}: ${formatDiff(diff)} kcal${partial ? ", vajaa kirjaus?" : ""}`}
                >
                  <span className="half">
                    {diff > 0 ? <Bar diff={diff} maxDiff={maxDiff} /> : null}
                  </span>
                  <span className="half">
                    {diff < 0 ? <Bar diff={diff} maxDiff={maxDiff} /> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="axis">
            <span>{formatDate(days[0].date)}</span>
            <span>eilen</span>
          </div>
        </>
      )}
    </section>
  );
};

export { IntakeHistory };
