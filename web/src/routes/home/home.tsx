import React, { useMemo } from "react";
import { WeightGraph } from "./components/weight-graph";
import "./home.css";

const WEIGHT_DATA = [
  { date: "2025-01-01", weight: 90 },
  { date: "2025-02-01", weight: 88 },
  { date: "2025-03-01", weight: 87 },
  { date: "2025-04-01", weight: 86 },
  { date: "2025-05-01", weight: 85 },
  { date: "2025-06-01", weight: 84 },
  { date: "2025-07-01", weight: 83 },
];

const HomeRoute: React.FC = () => {
  const now = useMemo(() => new Date().toISOString(), []);
  return (
    <div className="home-root">
      <WeightGraph
        now={now}
        history={WEIGHT_DATA}
        targetDate="2025-09-01T00:00:00Z"
        targetWeight={78}
      />
    </div>
  );
};

export { HomeRoute };
