import React, { useMemo } from "react";
import { Bar, BarChart, ReferenceLine, ResponsiveContainer, YAxis } from "recharts";

type CustomBarProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};
const CustomBar: React.FC<CustomBarProps> = (props) => {
  const { x, y, width, height } = props;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    height === 0
  ) {
    return null;
  }
  return (
    <g>
      <path
        d={`M${x},${y} L${x},${y + height}`}
        stroke="var(--color-border-muted)"
        strokeWidth="1"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        d={`M${x + width},${y} L${x + width},${y + height}`}
        stroke="var(--color-border-muted)"
        strokeWidth="1"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        d={`M${x},${y} L${x + width},${y}`}
        stroke="var(--color-text)"
        strokeWidth="2"
        fill="none"
      />
    </g>
  );
};

type IntakeHistoryProps = {
  target: number;
  history: {
    date: string;
    kcal: number;
  }[];
};
const IntakeHistory: React.FC<IntakeHistoryProps> = ({ target, history }) => {
  const chartData = useMemo(() => {
    return history.map((entry) => {
      const diff = entry.kcal - target;
      return {
        date: entry.date,
        kcal: Math.round(Math.abs(diff) <= 50 ? 0 : diff),
      };
    });
  }, [history, target]);
  const max = Math.max(...chartData.map((d) => Math.abs(d.kcal)), 0);
  return (
    <div className="intake-history">
      <div className="header">
        <h3>Kalorit (2 vko)</h3>
      </div>
      <div className="chart-container">
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 24, right: 0, left: 0, bottom: 24 }}>
            <YAxis domain={[-1 * max, 1 * max]} hide={true} />
            <ReferenceLine stroke="var(--color-border)" strokeDasharray="4 4" y={0} />
            <Bar
              activeBar={false}
              isAnimationActive={false}
              dataKey="kcal"
              shape={<CustomBar />}
              label={{
                fill: "var(--color-text)",
                fillOpacity: 0.75,
                fontFamily: "GeistMono, monospace",
                fontSize: 13,
                letterSpacing: "-0.04em",
                position: "top",
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export { IntakeHistory };
