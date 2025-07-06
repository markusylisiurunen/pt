import React, { useMemo } from "react";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";

function getDateString(date: string | number): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type WeightProps = {
  history: { date: string; weight: number }[];
  target: { date: string; weight: number };
};

const Weight: React.FC<WeightProps> = ({ history, target }) => {
  const minWeight = Math.min(target.weight, ...history.map((i) => i.weight));
  const maxWeight = Math.max(target.weight, ...history.map((i) => i.weight));

  const latestDate = history.at(-1)?.date ?? "2000-01-01T00:00:00Z";
  const latestWeight = history.at(-1)?.weight ?? 0;

  const chartData = useMemo(() => {
    if (history.length === 0) {
      return [];
    }

    const minDate = Math.min(
      ...history.map((i) => new Date(i.date).getTime()),
      new Date(target.date).getTime(),
    );
    const maxDate = Math.max(
      ...history.map((i) => new Date(i.date).getTime()),
      new Date(target.date).getTime(),
    );

    const actualWeights = new Map(history.map((i) => [getDateString(i.date), i.weight]));

    let now = minDate;
    const data: { date: string; actualWeight?: number; targetWeight: number }[] = [];

    while (now <= maxDate) {
      const dateStr = getDateString(now);

      const progress = (now - minDate) / (maxDate - minDate);
      const startWeight = history.at(0)!.weight;
      const targetWeight = startWeight + progress * (target.weight - startWeight);

      const actualWeight = actualWeights.get(dateStr);

      data.push({ date: dateStr, actualWeight: actualWeight, targetWeight: targetWeight });

      now += 24 * 60 * 60 * 1000;
    }

    return data;
  }, [history, target]);

  return (
    <div className="h-full w-full">
      <div
        className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/75"
        style={{ height: "calc(100% - 28px)" }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <YAxis hide={true} domain={[minWeight - 2, maxWeight + 2]} />
            <Line
              type="monotone"
              dataKey="actualWeight"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
              activeDot={false}
              connectNulls={true}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="targetWeight"
              stroke="currentColor"
              strokeWidth={2}
              strokeDasharray="5 5"
              activeDot={false}
              dot={false}
              isAnimationActive={false}
              style={{ opacity: 0.33 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex h-[28px] items-center">
        <span className="text-xs text-neutral-400">
          Viimeisin mitattu paino on{" "}
          {latestWeight.toLocaleString("fi-FI", {
            maximumFractionDigits: 1,
            minimumFractionDigits: 1,
          })}{" "}
          kg ({getDateString(latestDate)})
        </span>
      </div>
    </div>
  );
};

export { Weight };
