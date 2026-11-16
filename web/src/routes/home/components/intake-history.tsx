import React from "react";
import { addDays, getHelsinkiDate } from "../../../util/transform";

const HISTORY_DAYS = 14;
// Days within this many kcal of the target count as on target.
const ON_TARGET_KCAL = 50;

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
    };
  });
  const loggedDiffs = days.flatMap((day) => (day.diff === null ? [] : [day.diff]));
  const maxDiff = Math.max(...loggedDiffs.map(Math.abs), ON_TARGET_KCAL);
  const averageKcal =
    target + loggedDiffs.reduce((sum, diff) => sum + diff, 0) / loggedDiffs.length;

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
          <span>Kirjattu ka. {Math.round(averageKcal).toLocaleString("fi-FI")} kcal / pv</span>
        ) : null}
      </header>
      {days.every((day) => day.diff === null) ? (
        <p className="empty">Ei kirjauksia kahteen viikkoon.</p>
      ) : (
        <>
          <ol className="days">
            {days.map(({ date, diff }) => {
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
                  className={diff > 0 ? "over" : "under"}
                  title={`${formatDate(date)}: ${formatDiff(diff)} kcal`}
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
