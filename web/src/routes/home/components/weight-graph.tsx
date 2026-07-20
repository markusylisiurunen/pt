import { GoalIcon } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Label, Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";
import { Toggle } from "../../../components/toggle";
import { addDays, calculateSmoothWeightHistory, daysBetween } from "../../../util/transform";

const HISTORY_DAYS = 6 * 4 * 7;

function getHelsinkiDate(date: string): string {
  const parts = new Intl.DateTimeFormat("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Helsinki",
    year: "numeric",
  }).formatToParts(new Date(date));
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

function formatWeight(weight: number): string {
  return `${weight.toLocaleString("fi-FI", { maximumFractionDigits: 1 })} kg`;
}

type WeightGraphProps = {
  now: string;
  history: { date: string; weight: number }[];
  targetDate: string;
  targetWeight: number;
};

const WeightGraph: React.FC<WeightGraphProps> = ({ now, history, targetDate, targetWeight }) => {
  const [movingAverageDays, setMovingAverageDays] = useState(1);
  const [hideWeights, setHideWeights] = useState(false);

  const nowDate = getHelsinkiDate(now);
  const targetDateValue = getHelsinkiDate(targetDate);
  const chartStartDate = addDays(nowDate, -HISTORY_DAYS);
  const chartEndDate = targetDateValue > nowDate ? targetDateValue : nowDate;

  const visibleHistory = useMemo(
    () => history.filter((entry) => entry.date >= chartStartDate && entry.date <= nowDate),
    [chartStartDate, history, nowDate],
  );
  const currentWeight = visibleHistory.at(-1)?.weight ?? null;
  const observedHistory = useMemo(
    () => calculateSmoothWeightHistory(visibleHistory, movingAverageDays),
    [movingAverageDays, visibleHistory],
  );
  const hasProjection = currentWeight !== null && targetDateValue > nowDate;

  const chartData = useMemo(() => {
    const observedWeights = new Map(observedHistory.map((entry) => [entry.date, entry.weight]));
    const projectionDays = hasProjection ? daysBetween(nowDate, targetDateValue) : 0;
    const data: {
      date: string;
      currentWeight: number | null;
      targetWeight: number | null;
    }[] = [];

    for (let date = chartStartDate; date <= chartEndDate; date = addDays(date, 1)) {
      let projectedWeight = null;
      if (hasProjection && date >= nowDate) {
        const progress = daysBetween(nowDate, date) / projectionDays;
        projectedWeight = currentWeight + (targetWeight - currentWeight) * progress;
      }
      data.push({
        date,
        currentWeight: observedWeights.get(date) ?? null,
        targetWeight: projectedWeight,
      });
    }

    return data;
  }, [
    chartEndDate,
    chartStartDate,
    currentWeight,
    hasProjection,
    nowDate,
    observedHistory,
    targetDateValue,
    targetWeight,
  ]);

  const visibleWeights = chartData.flatMap((entry) =>
    [entry.currentWeight, entry.targetWeight].filter((weight): weight is number => weight !== null),
  );
  if (currentWeight !== null) {
    visibleWeights.push(currentWeight);
  }

  const valueMin = visibleWeights.length > 0 ? Math.min(...visibleWeights) : 0;
  const valueMax = visibleWeights.length > 0 ? Math.max(...visibleWeights) : 0;
  const valueSpan = Math.max(valueMax - valueMin, 2);
  const valueMiddle = (valueMin + valueMax) / 2;
  const domainPadding = valueSpan * 0.1;
  const domain = [
    valueMiddle - valueSpan / 2 - domainPadding,
    valueMiddle + valueSpan / 2 + domainPadding,
  ];

  const referenceWeights = new Map<string, { current: boolean; weight: number }>();
  if (visibleWeights.length > 0) {
    referenceWeights.set(formatWeight(valueMin), { current: false, weight: valueMin });
    referenceWeights.set(formatWeight(valueMax), { current: false, weight: valueMax });
  }
  if (currentWeight !== null) {
    referenceWeights.set(formatWeight(currentWeight), { current: true, weight: currentWeight });
  }

  const weeklyChange = hasProjection
    ? ((targetWeight - currentWeight) / daysBetween(nowDate, targetDateValue)) * 7
    : null;

  return (
    <div className="weight-graph">
      <div className="header">
        <h3>Painon kehitys</h3>
        {weeklyChange !== null ? (
          <span>
            {weeklyChange.toLocaleString("fi-FI", {
              maximumFractionDigits: 2,
              signDisplay: "exceptZero",
            })}{" "}
            kg/vko <GoalIcon size={16} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <div className="chart-container">
        {currentWeight === null ? (
          <div className="empty">Ei painomittauksia</div>
        ) : (
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
              <YAxis domain={domain} hide={true} />
              {[...referenceWeights.entries()].map(([label, reference]) => (
                <ReferenceLine
                  key={label}
                  stroke="var(--color-border)"
                  strokeDasharray="4 4"
                  y={reference.weight}
                >
                  {!hideWeights ? (
                    <Label
                      dy={reference.weight > valueMiddle ? 14 : -14}
                      fill="var(--color-text)"
                      fillOpacity={reference.current ? 1 : 0.75}
                      fontFamily="GeistMono, monospace"
                      fontSize={14}
                      letterSpacing="-0.04em"
                    >
                      {label}
                    </Label>
                  ) : null}
                </ReferenceLine>
              ))}
              <Line
                activeDot={false}
                dataKey="currentWeight"
                dot={observedHistory.length === 1 ? { r: 3 } : false}
                isAnimationActive={false}
                stroke="var(--color-text)"
                strokeOpacity={1}
                strokeWidth={1.5}
                type="linear"
              />
              <Line
                activeDot={false}
                dataKey="targetWeight"
                dot={false}
                isAnimationActive={false}
                stroke="var(--color-text)"
                strokeDasharray="3 3"
                strokeOpacity={0.75}
                strokeWidth={1.5}
                type="linear"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="dates">
        <span>{formatDate(chartStartDate)}</span>
        <span>{formatDate(chartEndDate)}</span>
      </div>
      {currentWeight !== null ? (
        <div className="moving-average">
          <div>
            <span>Keskiarvo (3 pv)</span>
            <Toggle
              isActive={movingAverageDays === 3}
              onToggle={() => setMovingAverageDays((prev) => (prev === 3 ? 1 : 3))}
            />
          </div>
          <div>
            <span>Keskiarvo (7 pv)</span>
            <Toggle
              isActive={movingAverageDays === 7}
              onToggle={() => setMovingAverageDays((prev) => (prev === 7 ? 1 : 7))}
            />
          </div>
          <div>
            <span>Piilota painot</span>
            <Toggle isActive={hideWeights} onToggle={() => setHideWeights((prev) => !prev)} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export { WeightGraph };
