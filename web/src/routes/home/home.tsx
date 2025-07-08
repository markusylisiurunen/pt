import React, { useMemo } from "react";
import { useNavigate } from "react-router";
import { IntakeCard } from "./components/intake-card";
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
  const navigate = useNavigate();
  const now = useMemo(() => new Date().toISOString(), []);
  return (
    <div className="home-root">
      <button onClick={() => navigate(`/chats/${crypto.randomUUID()}`)}>Keskustele</button>
      <div className="intake">
        <IntakeCard
          heading="Kalorit"
          current={2000}
          target={1800}
          unit="kcal"
          maximumFractionDigits={0}
        />
        <IntakeCard
          heading="Proteiini"
          current={128.4}
          target={160}
          unit="g"
          maximumFractionDigits={1}
        />
      </div>
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
