import { ArrowRightIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { IntakeCard } from "./components/intake-card";
import { WeightGraph } from "./components/weight-graph";
import "./home.css";

const HomeRoute: React.FC = () => {
  const navigate = useNavigate();
  const now = useMemo(() => new Date().toISOString(), []);

  const [dailyIntake, setDailyIntake] = useState({ kcal: 0, protein: 0 });
  const [dailyTarget, setDailyTarget] = useState({ kcal: 0, protein: 0 });
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);
  const [targetWeightDate, setTargetWeightDate] = useState<string>("");
  const [targetWeightValue, setTargetWeightValue] = useState<number>(0);

  function handleLogout() {
    window.localStorage.removeItem("token");
    navigate("/login", { replace: true });
  }

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const resp = await fetch("/api/config", {
        headers: {
          authorization: `Bearer ${window.localStorage.getItem("token")}`,
        },
      });
      if (resp.ok) {
        const data = (await resp.json()) as {
          config: {
            targetDailyIntakeCalories: number;
            targetDailyIntakeProtein: number;
            targetWeightDate: string;
            targetWeightValue: number;
          };
          foodIntakeToday: {
            kcal: number;
            protein: number;
          };
          weightHistory: {
            date: string;
            weight: number;
          }[];
        };
        setDailyIntake({
          kcal: data.foodIntakeToday.kcal,
          protein: data.foodIntakeToday.protein,
        });
        setDailyTarget({
          kcal: data.config.targetDailyIntakeCalories,
          protein: data.config.targetDailyIntakeProtein,
        });
        setWeightHistory(data.weightHistory);
        setTargetWeightDate(data.config.targetWeightDate);
        setTargetWeightValue(data.config.targetWeightValue);
      }
    });
  }, []);

  return (
    <div className="home-root">
      <div className="header">
        <button onClick={handleLogout}>Poistu</button>
        <button onClick={() => navigate(`/chats/${crypto.randomUUID()}`)}>
          <span>Keskustele</span>
          <ArrowRightIcon size={20} strokeWidth={2.25} />
        </button>
      </div>
      <div className="intake">
        <IntakeCard
          heading="Kalorit"
          current={dailyIntake.kcal}
          target={dailyTarget.kcal}
          unit="kcal"
          maximumFractionDigits={0}
        />
        <IntakeCard
          heading="Proteiini"
          current={dailyIntake.protein}
          target={dailyTarget.protein}
          unit="g"
          maximumFractionDigits={1}
        />
      </div>
      <WeightGraph
        now={now}
        history={weightHistory}
        targetDate={targetWeightDate}
        targetWeight={targetWeightValue}
      />
    </div>
  );
};

export { HomeRoute };
