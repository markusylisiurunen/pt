import { ArrowRightIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { FoodLogEntries } from "./components/food-log-entries";
import { IntakeCard } from "./components/intake-card";
import { Memories } from "./components/memories";
import { WeightGraph } from "./components/weight-graph";
import "./home.css";

const HomeRoute: React.FC = () => {
  const navigate = useNavigate();
  const now = useMemo(() => new Date().toISOString(), []);

  const [memories, setMemories] = useState<string[]>([]);
  const [dailyIntake, setDailyIntake] = useState({ kcal: 0, protein: 0 });
  const [dailyTarget, setDailyTarget] = useState({ kcal: 0, protein: 0 });
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);
  const [targetWeightDate, setTargetWeightDate] = useState<string>("");
  const [targetWeightValue, setTargetWeightValue] = useState<number>(0);
  const [foodLogToday, setFoodLogToday] = useState<
    {
      ts: string;
      label: string;
      kcal: number;
      protein: number;
    }[]
  >([]);

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
            memoryEntries: string[];
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
          foodLogToday: {
            ts: string;
            label: string;
            kcal: number;
            protein: number;
          }[];
        };
        setMemories(data.config.memoryEntries);
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
        setFoodLogToday(data.foodLogToday);
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
      <FoodLogEntries entries={foodLogToday} />
      <Link to="/training-program">
        <span>Treeniohjelma</span>
        <ArrowRightIcon size={20} strokeWidth={2} />
      </Link>
      <Memories memories={memories} />
    </div>
  );
};

export { HomeRoute };
