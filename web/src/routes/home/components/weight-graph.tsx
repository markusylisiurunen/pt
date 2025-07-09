import React, { useMemo } from "react";
import { Label, Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("fi-FI", { day: "2-digit", month: "2-digit" });
}

type WeightGraphProps = {
  now: string;
  history: { date: string; weight: number }[];
  targetDate: string;
  targetWeight: number;
};
const WeightGraph: React.FC<WeightGraphProps> = ({ now, history, targetDate, targetWeight }) => {
  const domainMin = Math.min(...history.map((d) => d.weight), targetWeight);
  const domainMax = Math.max(...history.map((d) => d.weight), targetWeight);

  const chartData = useMemo(() => {
    const DAY = 24 * 60 * 60 * 1000;

    const minDate = Math.min(
      ...history.map((d) => new Date(d.date).getTime()),
      new Date(targetDate).getTime()
    );
    const maxDate = Math.max(
      ...history.map((d) => new Date(d.date).getTime()),
      new Date(targetDate).getTime()
    );

    const data: {
      date: string;
      currentWeight: number | null;
      targetWeight: number | null;
    }[] = [];

    for (let date = minDate; date <= maxDate; date += DAY) {
      const dateStr = new Date(date).toISOString().split("T")[0];
      data.push({ date: dateStr, currentWeight: null, targetWeight: null });
    }

    history.forEach((i) => {
      const dateStr = new Date(i.date).toISOString().split("T")[0];
      const index = data.findIndex((d) => d.date === dateStr);
      if (index === -1) return;
      data[index].currentWeight = i.weight;
    });

    const targetStartWeight = history.at(-1)?.weight || 0;
    const targetEndWeight = targetWeight;

    for (let date = new Date(now).getTime(); date <= maxDate; date += 24 * 60 * 60 * 1000) {
      const dateStr = new Date(date).toISOString().split("T")[0];
      const index = data.findIndex((d) => d.date === dateStr);
      if (index === -1) continue;
      const progress = (date - new Date(now).getTime()) / (maxDate - new Date(now).getTime());
      const weight = targetStartWeight + (targetEndWeight - targetStartWeight) * progress;
      data[index].targetWeight = weight;
    }

    return data;
  }, [now, history, targetDate, targetWeight]);

  return (
    <div className="weight-graph">
      <h3>Painon kehitys</h3>
      <div className="chart-container">
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
            <YAxis domain={[domainMin, domainMax]} hide={true} />
            <ReferenceLine
              stroke="color-mix(in srgb, var(--color-text) 25%, transparent)"
              strokeDasharray="3 3"
              y={domainMax}
            >
              <Label
                dy={14}
                fill="color-mix(in srgb, var(--color-text) 50%, transparent)"
                fontFamily="GeistMono, monospace"
                fontSize={14}
                letterSpacing="-0.04em"
              >{`${domainMax.toLocaleString("fi-FI", { maximumFractionDigits: 1 })} kg`}</Label>
            </ReferenceLine>
            <ReferenceLine
              stroke="color-mix(in srgb, var(--color-text) 25%, transparent)"
              strokeDasharray="3 3"
              y={domainMin}
            >
              <Label
                dy={-14}
                fill="color-mix(in srgb, var(--color-text) 50%, transparent)"
                fontFamily="GeistMono, monospace"
                fontSize={14}
                letterSpacing="-0.04em"
              >{`${domainMin.toLocaleString("fi-FI", { maximumFractionDigits: 1 })} kg`}</Label>
            </ReferenceLine>
            <ReferenceLine
              stroke="color-mix(in srgb, var(--color-text) 25%, transparent)"
              strokeDasharray="3 3"
              y={history.at(-1)?.weight || -999}
            >
              <Label
                dy={14}
                fill="color-mix(in srgb, var(--color-text) 50%, transparent)"
                fontFamily="GeistMono, monospace"
                fontSize={14}
                letterSpacing="-0.04em"
              >{`${(history.at(-1)?.weight || -999).toLocaleString("fi-FI", {
                maximumFractionDigits: 1,
              })} kg`}</Label>
            </ReferenceLine>
            <Line
              activeDot={false}
              connectNulls={true}
              dataKey="currentWeight"
              dot={false}
              isAnimationActive={false}
              stroke="var(--color-text)"
              type="monotone"
            />
            <Line
              activeDot={false}
              connectNulls={true}
              dataKey="targetWeight"
              dot={false}
              isAnimationActive={false}
              stroke="var(--color-text)"
              strokeDasharray="3 3"
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="dates">
        <span>{formatDate(history.at(0)?.date ?? new Date().toISOString())}</span>
        <span>{formatDate(targetDate)}</span>
      </div>
    </div>
  );
};

export { WeightGraph };
